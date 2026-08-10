const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { canAccessTicket } = require('../utils/ticketAccess');
const { Ticket, Comment } = require('../models');

async function loadAccessibleTicket(req, next) {
  const ticket = await Ticket.findByPk(req.params.ticketId);
  if (!ticket) {
    next(new AppError('Ticket not found.', 404));
    return null;
  }
  if (!canAccessTicket(req.user, ticket)) {
    next(new AppError('You do not have permission to access this ticket.', 403));
    return null;
  }
  return ticket;
}

const createComment = catchAsync(async (req, res, next) => {
  const ticket = await loadAccessibleTicket(req, next);
  if (!ticket) return;

  const comment = await Comment.create({
    text: req.body.text,
    ticketId: ticket.id,
    authorId: req.user.id,
  });

  res.status(201).json({ comment });
});

const listComments = catchAsync(async (req, res, next) => {
  const ticket = await loadAccessibleTicket(req, next);
  if (!ticket) return;

  const comments = await Comment.findAll({
    where: { ticketId: ticket.id },
    order: [['createdAt', 'ASC']],
  });

  res.status(200).json({ comments });
});

module.exports = { createComment, listComments };
