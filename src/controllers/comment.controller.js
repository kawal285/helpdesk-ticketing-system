const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const {
  canAccessTicket,
} = require('../utils/ticketAccess');

const {
  notifyCommentAdded,
} = require('../services/notificationService');

const { getProvider } = require('../services/ticketProviders');

const {
  Comment,
  User,
} = require('../models');

// Goes through the ticket provider (not a direct Ticket.findByPk) so
// comments still resolve their ticket correctly when TICKET_PROVIDER
// points at a real CRM instead of this app's own tables -- see
// docs/PROVIDERS.md. Comments themselves stay in this app's own table
// either way; only the ticket they're attached to may live elsewhere.
async function loadAccessibleTicket(req, next) {
  const ticket = await getProvider().getTicketById(req.params.ticketId);

  if (!ticket) {
    next(
      new AppError(
        'Ticket not found.',
        404
      )
    );

    return null;
  }

  if (
    !canAccessTicket(req.user, ticket)
  ) {
    next(
      new AppError(
        'You do not have permission to access this ticket.',
        403
      )
    );

    return null;
  }

  return ticket;
}

const createComment = catchAsync(
  async (req, res, next) => {
    const ticket =
      await loadAccessibleTicket(
        req,
        next
      );

    if (!ticket) return;

    const createdComment =
      await Comment.create({
        text: req.body.text,
        ticketId: ticket.id,
        authorId: req.user.id,
      });

    /*
     * Reload the comment with its author so the frontend can
     * immediately display the author's name.
     */
    const comment =
      await Comment.findByPk(
        createdComment.id,
        {
          include: [
            {
              model: User,
              as: 'author',
              attributes: [
                'id',
                'name',
                'email',
                'role',
              ],
            },
          ],
        }
      );

    const author =
      comment.author || req.user;

    let recipient = null;

    /*
     * Customer comments notify the assigned agent.
     * Agent/admin comments notify the requester.
     */
    if (
      req.user.role === 'customer'
    ) {
      recipient = ticket.assignee;
    } else {
      recipient = ticket.requester;
    }

    /*
     * Do not send an email back to the person who posted the
     * comment. Unassigned tickets may not yet have an agent
     * recipient, in which case notificationService safely skips it.
     */
    if (
      recipient &&
      Number(recipient.id) !==
        Number(req.user.id)
    ) {
      await notifyCommentAdded({
        ticket,
        recipient,
        author,
        comment,
      });
    }

    res.status(201).json({
      comment,
    });
  }
);

const listComments = catchAsync(
  async (req, res, next) => {
    const ticket =
      await loadAccessibleTicket(
        req,
        next
      );

    if (!ticket) return;

    const comments =
      await Comment.findAll({
        where: {
          ticketId: ticket.id,
        },
        order: [
          ['createdAt', 'ASC'],
        ],
        include: [
          {
            model: User,
            as: 'author',
            attributes: [
              'id',
              'name',
              'role',
            ],
          },
        ],
      });

    res.status(200).json({
      comments,
    });
  }
);

module.exports = {
  createComment,
  listComments,
};