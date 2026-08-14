const { Op, Transaction } = require('sequelize');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { computeDueAt } = require('../utils/sla');
const { isValidTransition, editPermissionError } = require('../utils/ticketStatus');
const { canAccessTicket } = require('../utils/ticketAccess');
const { pickLeastBusyAgent } = require('../services/routingService');
const { getAiSuggestions } = require('../services/aiService');
const { Ticket, User, sequelize } = require('../models');

// Server-side visibility scope, ignoring/overriding any client-supplied
// filters that would widen access: customer sees only their own tickets,
// agent sees tickets assigned to them plus the unassigned pool, admin sees
// everything.
function scopeForUser(user) {
  if (user.role === 'admin') return {};
  if (user.role === 'customer') return { requesterId: user.id };
  return { [Op.or]: [{ assigneeId: user.id }, { assigneeId: null }] };
}

// Shared by every single-ticket endpoint below: loads the ticket and applies
// the same 404-on-inaccessible rule comment.controller.js uses, so callers
// just do `if (!ticket) return;` and carry on.
async function loadAccessibleTicket(req, next) {
  const ticket = await Ticket.findByPk(req.params.id);
  if (!ticket || !canAccessTicket(req.user, ticket)) {
    next(new AppError('Ticket not found.', 404));
    return null;
  }
  return ticket;
}

const createTicket = catchAsync(async (req, res) => {
  const { title, description, category, priority } = req.body;
  const createdAt = new Date();

  // Only call the AI if the requester left something blank -- and never let
  // it block ticket creation: getAiSuggestions never throws, it returns
  // nulls if the AI is unconfigured, down, or too slow (see aiService.js).
  const needsAi = !category || !priority;
  const ai = needsAi
    ? await getAiSuggestions(description)
    : { category: null, priority: null, suggestedResponse: null };
  const aiSucceeded = ai.category !== null;

  // A human-supplied category/priority always wins over the AI's guess.
  const finalCategory = category || ai.category || 'Other';
  const finalPriority = priority || ai.priority || 'Medium';

  // Auto-assignment must happen in the same transaction as the insert so the
  // "fewest open tickets" count and the assignment stay consistent under
  // concurrent ticket creation.
  const ticket = await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
    async (t) => {
      const assigneeId = await pickLeastBusyAgent(t);
      return Ticket.create(
        {
          title,
          description,
          category: finalCategory,
          priority: finalPriority,
          requesterId: req.user.id,
          organization: req.user.organization,
          assigneeId,
          dueAt: computeDueAt(finalPriority, createdAt),
          aiCategory: ai.category,
          aiPriority: ai.priority,
          aiSuggestedResponse: ai.suggestedResponse,
          aiAnalyzedAt: aiSucceeded ? new Date() : null,
        },
        { transaction: t }
      );
    }
  );

  res.status(201).json({ ticket });
});

const listTickets = catchAsync(async (req, res) => {
  const where = { ...scopeForUser(req.user) };
  if (req.query.status) where.status = req.query.status;
  if (req.query.priority) where.priority = req.query.priority;
  if (req.query.category) where.category = req.query.category;
  if (req.query.organization) where.organization = req.query.organization;
  if (req.query.assigneeId) where.assigneeId = req.query.assigneeId;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

  const { rows, count } = await Ticket.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    include: [
      { model: User, as: 'requester', attributes: ['id', 'name'] },
      { model: User, as: 'assignee', attributes: ['id', 'name'] },
    ],
  });

  res.status(200).json({ tickets: rows, total: count, page, limit });
});

const getOverdueTickets = catchAsync(async (req, res) => {
  const where = {
    ...scopeForUser(req.user),
    dueAt: { [Op.lt]: new Date() },
    status: { [Op.notIn]: ['Resolved', 'Closed'] },
  };

  const tickets = await Ticket.findAll({ where, order: [['dueAt', 'ASC']] });
  res.status(200).json({ tickets });
});

const getTicket = catchAsync(async (req, res, next) => {
  const ticket = await loadAccessibleTicket(req, next);
  if (!ticket) return;

  res.status(200).json({ ticket });
});

const updateTicket = catchAsync(async (req, res, next) => {
  const ticket = await loadAccessibleTicket(req, next);
  if (!ticket) return;

  const { title, description, category, priority, status, assigneeId } = req.body;

  // Status and assignment are staff-only actions, same as their dedicated
  // /status and /assign endpoints -- customers can only touch the detail
  // fields below, and only while editPermissionError allows it.
  const isStaff = req.user.role === 'agent' || req.user.role === 'admin';
  if ((status !== undefined || assigneeId !== undefined) && !isStaff) {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }

  if (title !== undefined || description !== undefined || category !== undefined || priority !== undefined) {
    const editError = editPermissionError(req.user, ticket);
    if (editError) {
      return next(new AppError(editError, 403));
    }
  }

  if (title !== undefined) ticket.title = title;
  if (description !== undefined) ticket.description = description;
  if (category !== undefined) ticket.category = category;
  if (priority !== undefined) {
    ticket.priority = priority;
    ticket.dueAt = computeDueAt(priority, ticket.createdAt);
  }

  if (status !== undefined) {
    const isAdmin = req.user.role === 'admin';
    if (!isValidTransition(ticket.status, status, isAdmin)) {
      return next(new AppError(`Cannot transition ticket from ${ticket.status} to ${status}.`, 409));
    }
    if (status === 'Resolved') {
      ticket.resolvedAt = new Date();
    } else if (status === 'Closed') {
      ticket.resolvedAt = ticket.resolvedAt || new Date();
    } else {
      ticket.resolvedAt = null;
    }
    ticket.status = status;
  }

  if (assigneeId !== undefined) {
    if (assigneeId === null) {
      ticket.assigneeId = null;
    } else {
      const agent = await User.findByPk(assigneeId);
      if (!agent || agent.role !== 'agent' || !agent.isActive) {
        return next(new AppError('assigneeId must be an active agent.', 400));
      }
      ticket.assigneeId = assigneeId;
    }
  }

  await ticket.save();
  res.status(200).json({ ticket });
});

const updateTicketStatus = catchAsync(async (req, res, next) => {
  const ticket = await loadAccessibleTicket(req, next);
  if (!ticket) return;

  const isAdmin = req.user.role === 'admin';
  const { status } = req.body;
  if (!isValidTransition(ticket.status, status, isAdmin)) {
    return next(new AppError(`Cannot transition ticket from ${ticket.status} to ${status}.`, 409));
  }

  if (status === 'Resolved') {
    ticket.resolvedAt = new Date();
  } else if (status === 'Closed') {
    ticket.resolvedAt = ticket.resolvedAt || new Date();
  } else {
    ticket.resolvedAt = null;
  }
  ticket.status = status;

  await ticket.save();
  res.status(200).json({ ticket });
});

const assignTicket = catchAsync(async (req, res, next) => {
  const ticket = await loadAccessibleTicket(req, next);
  if (!ticket) return;

  const { assigneeId } = req.body;
  if (assigneeId === null) {
    ticket.assigneeId = null;
  } else {
    const agent = await User.findByPk(assigneeId);
    if (!agent || agent.role !== 'agent' || !agent.isActive) {
      return next(new AppError('assigneeId must be an active agent.', 400));
    }
    ticket.assigneeId = assigneeId;
  }

  await ticket.save();
  res.status(200).json({ ticket });
});

const aiAnalyzeTicket = catchAsync(async (req, res, next) => {
  const ticket = await loadAccessibleTicket(req, next);
  if (!ticket) return;

  const ai = await getAiSuggestions(ticket.description);
  if (ai.category === null) {
    return next(new AppError('AI analysis is currently unavailable. Please try again later.', 503));
  }

  ticket.aiCategory = ai.category;
  ticket.aiPriority = ai.priority;
  ticket.aiSuggestedResponse = ai.suggestedResponse;
  ticket.aiAnalyzedAt = new Date();

  await ticket.save();
  res.status(200).json({ ticket });
});

module.exports = {
  createTicket,
  listTickets,
  getOverdueTickets,
  getTicket,
  updateTicket,
  updateTicketStatus,
  assignTicket,
  aiAnalyzeTicket,
};
