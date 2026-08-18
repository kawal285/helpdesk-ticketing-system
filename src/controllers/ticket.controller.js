const { Op, Transaction } = require('sequelize');

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
  pickLeastBusyAgent,
} = require('../services/routingService');

const {
  getAiSuggestions,
} = require('../services/aiService');

const {
  notifyTicketCreated,
  notifyTicketAssigned,
  notifyStatusChanged,
  notifyResolutionReviewed,
} = require('../services/notificationService');

const {
  Ticket,
  User,
  sequelize,
} = require('../models');

/*
 * Customer: only their own tickets.
 * Agent: assigned tickets and unassigned tickets.
 * Admin: every ticket.
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
    [Op.or]: [
      {
        assigneeId: user.id,
      },
      {
        assigneeId: null,
      },
    ],
  };
}

const personIncludes = [
  {
    model: User,
    as: 'requester',
    attributes: [
      'id',
      'name',
      'email',
      'role',
      'organization',
    ],
  },
  {
    model: User,
    as: 'assignee',
    attributes: [
      'id',
      'name',
      'email',
      'role',
    ],
    required: false,
  },
];

/*
 * Loads a ticket together with requester and assigned-agent
 * information and applies the same access rules to every endpoint.
 */
async function loadAccessibleTicket(req, next) {
  const ticket = await Ticket.findByPk(
    req.params.id,
    {
      include: personIncludes,
    }
  );

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

    /*
     * Assignment and creation use one transaction so concurrent
     * requests do not all select the same least-busy agent.
     */
    const ticket = await sequelize.transaction(
      {
        isolationLevel:
          Transaction.ISOLATION_LEVELS.SERIALIZABLE,
      },
      async (transaction) => {
        const assigneeId =
          await pickLeastBusyAgent(transaction);

        return Ticket.create(
          {
            title,
            description,
            category: finalCategory,
            priority: finalPriority,
            status: 'Open',
            requesterId: req.user.id,
            organization: req.user.organization,
            assigneeId,
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
          },
          {
            transaction,
          }
        );
      }
    );

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
    const where = {
      ...scopeForUser(req.user),
    };

    if (req.query.status) {
      where.status = req.query.status;
    }

    if (req.query.priority) {
      where.priority = req.query.priority;
    }

    if (req.query.category) {
      where.category = req.query.category;
    }

    if (req.query.organization) {
      where.organization =
        req.query.organization;
    }

    if (req.query.assigneeId) {
      where.assigneeId =
        req.query.assigneeId;
    }

    const page =
      parseInt(req.query.page, 10) || 1;

    const limit = Math.min(
      parseInt(req.query.limit, 10) || 20,
      100
    );

    const { rows, count } =
      await Ticket.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset: (page - 1) * limit,
        include: [
          {
            model: User,
            as: 'requester',
            attributes: ['id', 'name'],
          },
          {
            model: User,
            as: 'assignee',
            attributes: ['id', 'name'],
            required: false,
          },
        ],
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
    const where = {
      ...scopeForUser(req.user),
      dueAt: {
        [Op.lt]: new Date(),
      },
      status: {
        [Op.notIn]: [
          'Resolved',
          'Closed',
        ],
      },
    };

    const tickets = await Ticket.findAll({
      where,
      order: [['dueAt', 'ASC']],
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'name'],
        },
        {
          model: User,
          as: 'assignee',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
    });

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

    const originalStatus = ticket.status;
    const originalAssigneeId =
      ticket.assigneeId;

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

    if (title !== undefined) {
      ticket.title = title;
    }

    if (description !== undefined) {
      ticket.description = description;
    }

    if (category !== undefined) {
      ticket.category = category;
    }

    if (priority !== undefined) {
      ticket.priority = priority;

      ticket.dueAt = computeDueAt(
        priority,
        ticket.createdAt
      );
    }

    if (room !== undefined) {
      ticket.room = room;
    }

    if (parentCaseId !== undefined) {
      ticket.parentCaseId = parentCaseId;
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
        ticket.resolvedAt = new Date();
      } else if (status === 'Closed') {
        ticket.resolvedAt =
          ticket.resolvedAt ||
          new Date();
      } else {
        ticket.resolvedAt = null;
      }

      ticket.status = status;
    }

    if (assigneeId !== undefined) {
      if (assigneeId === null) {
        ticket.assigneeId = null;
      } else {
        const agent =
          await User.findByPk(
            assigneeId
          );

        if (
          !agent ||
          agent.role !== 'agent' ||
          !agent.isActive
        ) {
          return next(
            new AppError(
              'assigneeId must be an active agent.',
              400
            )
          );
        }

        ticket.assigneeId =
          assigneeId;
      }
    }

    await ticket.save();

    if (
      status !== undefined &&
      originalStatus !== ticket.status
    ) {
      await notifyStatusChanged({
        ticket,
        requester: ticket.requester,
      });
    }

    if (
      assigneeId !== undefined &&
      Number(originalAssigneeId) !==
        Number(ticket.assigneeId) &&
      ticket.assigneeId
    ) {
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
        requester: ticket.requester,
        assignee: assignedAgent,
      });
    }

    res.status(200).json({
      ticket,
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

    if (status === 'Resolved') {
      ticket.resolvedAt = new Date();
    } else if (status === 'Closed') {
      ticket.resolvedAt =
        ticket.resolvedAt ||
        new Date();
    } else {
      ticket.resolvedAt = null;
    }

    ticket.status = status;

    await ticket.save();

    await notifyStatusChanged({
      ticket,
      requester: ticket.requester,
    });

    res.status(200).json({
      ticket,
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

    if (assigneeId === null) {
      ticket.assigneeId = null;
    } else {
      const agent =
        await User.findByPk(assigneeId);

      if (
        !agent ||
        agent.role !== 'agent' ||
        !agent.isActive
      ) {
        return next(
          new AppError(
            'assigneeId must be an active agent.',
            400
          )
        );
      }

      ticket.assigneeId = assigneeId;
    }

    await ticket.save();

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
        requester: ticket.requester,
        assignee: assignedAgent,
      });
    }

    res.status(200).json({
      ticket,
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

    ticket.aiCategory = ai.category;
    ticket.aiPriority = ai.priority;
    ticket.aiSuggestedResponse =
      ai.suggestedResponse;
    ticket.aiAnalyzedAt = new Date();

    await ticket.save();

    res.status(200).json({
      ticket,
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

    if (action === 'accept') {
      ticket.status = 'Closed';

      ticket.resolvedAt =
        ticket.resolvedAt ||
        new Date();
    }

    if (action === 'reopen') {
      ticket.status =
        'In Progress';

      ticket.resolvedAt = null;
    }

    await ticket.save();

    await notifyResolutionReviewed({
      ticket,
      assignee: ticket.assignee,
      action,
    });

    res.status(200).json({
      message:
        action === 'accept'
          ? 'Resolution accepted and ticket closed.'
          : 'Ticket reopened for further investigation.',
      ticket,
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