const { Op } = require('sequelize');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { computeDueAt } = require('../utils/sla');
const { isValidTransition } = require('../utils/ticketStatus');
const { canAccessTicket } = require('../utils/ticketAccess');
const { Ticket } = require('../models');

// Server-side visibility scope, ignoring/overriding any client-supplied
// filters that would widen access: customer sees only their own tickets,
// agent sees tickets assigned to them plus the unassigned pool, admin sees
// everything.
function scopeForUser(user) {
  if (user.role === 'admin') return {};
  if (user.role === 'customer') return { requesterId: user.id };
  return { [Op.or]: [{ assigneeId: user.id }, { assigneeId: null }] };
}

const createTicket = catchAsync(async (req, res) => {
  const { title, description, category, priority } = req.body;
  const createdAt = new Date();

  const ticket = await Ticket.create({
    title,
    description,
    category,
    priority,
    requesterId: req.user.id,
    dueAt: computeDueAt(priority || 'Medium', createdAt),
  });

  res.status(201).json({ ticket });
});

const listTickets = catchAsync(async (req, res) => {
  const where = { ...scopeForUser(req.user) };
  if (req.query.status) where.status = req.query.status;
  if (req.query.priority) where.priority = req.query.priority;
  if (req.query.category) where.category = req.query.category;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

  const { rows, count } = await Ticket.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
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
  const ticket = await Ticket.findByPk(req.params.id);
  if (!ticket || !canAccessTicket(req.user, ticket)) {
    return next(new AppError('Ticket not found.', 404));
  }

  res.status(200).json({ ticket });
});

const updateTicket = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findByPk(req.params.id);
  if (!ticket || !canAccessTicket(req.user, ticket)) {
    return next(new AppError('Ticket not found.', 404));
  }

  if (req.user.role === 'customer' && ticket.status !== 'Open') {
    return next(new AppError('Only open tickets can be edited.', 403));
  }
  if (req.user.role === 'agent') {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }

  const { title, description, category, priority } = req.body;
  if (title !== undefined) ticket.title = title;
  if (description !== undefined) ticket.description = description;
  if (category !== undefined) ticket.category = category;
  if (priority !== undefined) {
    ticket.priority = priority;
    ticket.dueAt = computeDueAt(priority, ticket.createdAt);
  }

  await ticket.save();
  res.status(200).json({ ticket });
});

const updateTicketStatus = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findByPk(req.params.id);
  if (!ticket || !canAccessTicket(req.user, ticket)) {
    return next(new AppError('Ticket not found.', 404));
  }

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

module.exports = {
  createTicket,
  listTickets,
  getOverdueTickets,
  getTicket,
  updateTicket,
  updateTicketStatus,
};
