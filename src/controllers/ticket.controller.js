const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { computeDueAt } = require('../utils/sla');
const { DEFAULT_PRIORITY } = require('../utils/ticketFields');

const {
  isValidTransition,
  editPermissionError,
} = require('../utils/ticketStatus');

const {
  canAccessTicket,
} = require('../utils/ticketAccess');

const {
  getAiSuggestions,
} = require('../services/aiService');

const {
  notifyTicketCreated,
  notifyTicketAssigned,
  notifyStatusChanged,
  notifyResolutionReviewed,
} = require('../services/notificationService');

const { User } = require('../models');
const { getProvider } = require('../services/ticketProviders');

/*
 * Customer: only their own tickets.
 * Agent: assigned tickets and unassigned tickets.
 * Admin: every ticket.
 *
 * This is the CRM-agnostic filter shape every ticket provider accepts --
 * see src/services/ticketProviders/index.js for the full contract.
 */
function scopeForUser(user) {
  if (user.role === 'admin') {
    return {};
  }

  if (user.role === 'customer') {
    return {
      requesterId: user.id,
    };
  }

  return {
    assigneeIn: [user.id, null],
  };
}

/*
 * Loads a ticket together with requester and assigned-agent
 * information and applies the same access rules to every endpoint.
 */
async function loadAccessibleTicket(req, next) {
  const ticket = await getProvider().getTicketById(req.params.id);

  if (
    !ticket ||
    !canAccessTicket(req.user, ticket)
  ) {
    next(
      new AppError('Ticket not found.', 404)
    );

    return null;
  }

  return ticket;
}

// assigneeId validation is a User/auth concern (is this id an active
// agent?), not a ticket-storage one, so it stays a direct User lookup
// regardless of which ticket provider is active.
async function findAssignableAgent(assigneeId, next) {
  const agent = await User.findByPk(assigneeId);

  if (!agent || agent.role !== 'agent' || !agent.isActive) {
    next(
      new AppError(
        'assigneeId must be an active agent.',
        400
      )
    );

    return null;
  }

  return agent;
}

async function notifyIfAssigned(ticket) {
  if (!ticket.assigneeId) return;

  const assignedAgent = await User.findByPk(
    ticket.assigneeId,
    { attributes: ['id', 'name', 'email', 'role'] }
  );

  await notifyTicketAssigned({
    ticket,
    requester: ticket.requester,
    assignee: assignedAgent,
  });
}

const createTicket = catchAsync(
  async (req, res) => {
    const {
      title,
      description,
      category,
      priority,
      room,
      parentCaseId,
    } = req.body;

    const createdAt = new Date();

    /*
     * AI is only required when category or priority was not
     * selected. AI failure must never prevent ticket creation.
     */
    const needsAi = !category || !priority;

    const ai = needsAi
      ? await getAiSuggestions(description)
      : {
          category: null,
          priority: null,
          suggestedResponse: null,
        };

    const aiSucceeded = ai.category !== null;

    const finalCategory =
      category || ai.category || 'Other';

    const finalPriority =
      priority || ai.priority || DEFAULT_PRIORITY;

    const ticket = await getProvider().createTicket({
      title,
      description,
      category: finalCategory,
      priority: finalPriority,
      status: 'Open',
      requesterId: req.user.id,
      organization: req.user.organization,
      dueAt: computeDueAt(
        finalPriority,
        createdAt
      ),
      aiCategory: ai.category,
      aiPriority: ai.priority,
      aiSuggestedResponse:
        ai.suggestedResponse,
      aiAnalyzedAt: aiSucceeded
        ? new Date()
        : null,
      room: room || null,
      parentCaseId:
        parentCaseId || null,
    });

    const requester = await User.findByPk(
      req.user.id,
      {
        attributes: [
          'id',
          'name',
          'email',
          'role',
          'organization',
        ],
      }
    );

    await notifyTicketCreated({
      ticket,
      requester,
    });

    if (ticket.assigneeId) {
      const assignedAgent =
        await User.findByPk(
          ticket.assigneeId,
          {
            attributes: [
              'id',
              'name',
              'email',
              'role',
            ],
          }
        );

      await notifyTicketAssigned({
        ticket,
        requester,
        assignee: assignedAgent,
      });
    }

    res.status(201).json({
      ticket,
    });
  }
);

const listTickets = catchAsync(
  async (req, res) => {
    const filter = {
      ...scopeForUser(req.user),
    };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.priority) {
      filter.priority = req.query.priority;
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.organization) {
      filter.organization =
        req.query.organization;
    }

    if (req.query.assigneeId) {
      filter.assigneeId =
        req.query.assigneeId;
    }

    const page =
      parseInt(req.query.page, 10) || 1;

    const limit = Math.min(
      parseInt(req.query.limit, 10) || 20,
      100
    );

    const { rows, count } =
      await getProvider().listTickets(filter, {
        limit,
        offset: (page - 1) * limit,
      });

    res.status(200).json({
      tickets: rows,
      total: count,
      page,
      limit,
    });
  }
);

const getOverdueTickets = catchAsync(
  async (req, res) => {
    const filter = {
      ...scopeForUser(req.user),
      dueBefore: new Date(),
      statusNotIn: [
        'Resolved',
        'Closed',
      ],
    };

    const tickets = await getProvider().getOverdueTickets(filter);

    res.status(200).json({
      tickets,
    });
  }
);

const getTicket = catchAsync(
  async (req, res, next) => {
    const ticket =
      await loadAccessibleTicket(
        req,
        next
      );

    if (!ticket) return;

    res.status(200).json({
      ticket,
    });
  }
);

const updateTicket = catchAsync(
  async (req, res, next) => {
    const ticket =
      await loadAccessibleTicket(
        req,
        next
      );

    if (!ticket) return;

    const {
      title,
      description,
      category,
      priority,
      status,
      assigneeId,
      room,
      parentCaseId,
    } = req.body;

    const isStaff =
      req.user.role === 'agent' ||
      req.user.role === 'admin';

    if (
      (status !== undefined ||
        assigneeId !== undefined) &&
      !isStaff
    ) {
      return next(
        new AppError(
          'You do not have permission to perform this action.',
          403
        )
      );
    }

    if (
      title !== undefined ||
      description !== undefined ||
      category !== undefined ||
      priority !== undefined ||
      room !== undefined ||
      parentCaseId !== undefined
    ) {
      const editError =
        editPermissionError(
          req.user,
          ticket
        );

      if (editError) {
        return next(
          new AppError(editError, 403)
        );
      }
    }

    const changes = {};

    if (title !== undefined) {
      changes.title = title;
    }

    if (description !== undefined) {
      changes.description = description;
    }

    if (category !== undefined) {
      changes.category = category;
    }

    if (priority !== undefined) {
      changes.priority = priority;
      changes.dueAt = computeDueAt(
        priority,
        ticket.createdAt
      );
    }

    if (room !== undefined) {
      changes.room = room;
    }

    if (parentCaseId !== undefined) {
      changes.parentCaseId = parentCaseId;
    }

    if (status !== undefined) {
      const isAdmin =
        req.user.role === 'admin';

      if (
        !isValidTransition(
          ticket.status,
          status,
          isAdmin
        )
      ) {
        return next(
          new AppError(
            `Cannot transition ticket from ${ticket.status} to ${status}.`,
            409
          )
        );
      }

      if (status === 'Resolved') {
        changes.resolvedAt = new Date();
      } else if (status === 'Closed') {
        changes.resolvedAt =
          ticket.resolvedAt ||
          new Date();
      } else {
        changes.resolvedAt = null;
      }

      changes.status = status;
    }

    if (assigneeId !== undefined) {
      if (assigneeId === null) {
        changes.assigneeId = null;
      } else {
        const agent = await findAssignableAgent(assigneeId, next);
        if (!agent) return;

        changes.assigneeId = assigneeId;
      }
    }

    const updatedTicket = await getProvider().updateTicket(ticket.id, changes);

    if (
      status !== undefined &&
      ticket.status !== updatedTicket.status
    ) {
      await notifyStatusChanged({
        ticket: updatedTicket,
        requester: updatedTicket.requester,
      });
    }

    if (
      assigneeId !== undefined &&
      Number(ticket.assigneeId) !==
        Number(updatedTicket.assigneeId) &&
      updatedTicket.assigneeId
    ) {
      const assignedAgent =
        await User.findByPk(
          updatedTicket.assigneeId,
          {
            attributes: [
              'id',
              'name',
              'email',
              'role',
            ],
          }
        );

      await notifyTicketAssigned({
        ticket: updatedTicket,
        requester: updatedTicket.requester,
        assignee: assignedAgent,
      });
    }

    res.status(200).json({
      ticket: updatedTicket,
    });
  }
);

const updateTicketStatus = catchAsync(
  async (req, res, next) => {
    const ticket =
      await loadAccessibleTicket(
        req,
        next
      );

    if (!ticket) return;

    const isAdmin =
      req.user.role === 'admin';

    const { status } = req.body;

    if (
      !isValidTransition(
        ticket.status,
        status,
        isAdmin
      )
    ) {
      return next(
        new AppError(
          `Cannot transition ticket from ${ticket.status} to ${status}.`,
          409
        )
      );
    }

    const changes = { status };

    if (status === 'Resolved') {
      changes.resolvedAt = new Date();
    } else if (status === 'Closed') {
      changes.resolvedAt =
        ticket.resolvedAt ||
        new Date();
    } else {
      changes.resolvedAt = null;
    }

    const updatedTicket = await getProvider().updateTicket(ticket.id, changes);

    await notifyStatusChanged({
      ticket: updatedTicket,
      requester: updatedTicket.requester,
    });

    res.status(200).json({
      ticket: updatedTicket,
    });
  }
);

const assignTicket = catchAsync(
  async (req, res, next) => {
    const ticket =
      await loadAccessibleTicket(
        req,
        next
      );

    if (!ticket) return;

    const { assigneeId } = req.body;
    const changes = {};

    if (assigneeId === null) {
      changes.assigneeId = null;
    } else {
      const agent = await findAssignableAgent(assigneeId, next);
      if (!agent) return;

      changes.assigneeId = assigneeId;
    }

    const updatedTicket = await getProvider().updateTicket(ticket.id, changes);

    await notifyIfAssigned(updatedTicket);

    res.status(200).json({
      ticket: updatedTicket,
    });
  }
);

const aiAnalyzeTicket = catchAsync(
  async (req, res, next) => {
    const ticket =
      await loadAccessibleTicket(
        req,
        next
      );

    if (!ticket) return;

    const ai = await getAiSuggestions(
      ticket.description
    );

    if (ai.category === null) {
      return next(
        new AppError(
          'AI analysis is currently unavailable. Please try again later.',
          503
        )
      );
    }

    const updatedTicket = await getProvider().updateTicket(ticket.id, {
      aiCategory: ai.category,
      aiPriority: ai.priority,
      aiSuggestedResponse: ai.suggestedResponse,
      aiAnalyzedAt: new Date(),
    });

    res.status(200).json({
      ticket: updatedTicket,
    });
  }
);

const reviewTicketResolution = catchAsync(
  async (req, res, next) => {
    const ticket =
      await loadAccessibleTicket(
        req,
        next
      );

    if (!ticket) return;

    if (
      req.user.role !== 'customer' ||
      Number(ticket.requesterId) !==
        Number(req.user.id)
    ) {
      return next(
        new AppError(
          'Only the customer who created this ticket can review its resolution.',
          403
        )
      );
    }

    if (ticket.status !== 'Resolved') {
      return next(
        new AppError(
          'Only resolved tickets can be reviewed.',
          409
        )
      );
    }

    const { action } = req.body;

    if (
      !['accept', 'reopen'].includes(
        action
      )
    ) {
      return next(
        new AppError(
          'Review action must be either accept or reopen.',
          400
        )
      );
    }

    const changes = {};

    if (action === 'accept') {
      changes.status = 'Closed';
      changes.resolvedAt =
        ticket.resolvedAt ||
        new Date();
    }

    if (action === 'reopen') {
      changes.status = 'In Progress';
      changes.resolvedAt = null;
    }

    const updatedTicket = await getProvider().updateTicket(ticket.id, changes);

    await notifyResolutionReviewed({
      ticket: updatedTicket,
      assignee: updatedTicket.assignee,
      action,
    });

    res.status(200).json({
      message:
        action === 'accept'
          ? 'Resolution accepted and ticket closed.'
          : 'Ticket reopened for further investigation.',
      ticket: updatedTicket,
    });
  }
);

module.exports = {
  createTicket,
  listTickets,
  getOverdueTickets,
  getTicket,
  updateTicket,
  updateTicketStatus,
  assignTicket,
  aiAnalyzeTicket,
  reviewTicketResolution,
};
