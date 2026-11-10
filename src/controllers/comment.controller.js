const catchAsync = require('../utils/catchAsync');
const { findAccessibleTicket } = require('../services/ticketAccessService');

const {
  notifyCommentAdded,
} = require('../services/notificationService');

const { getProvider } = require('../services/ticketProviders');

const {
  Comment,
  User,
} = require('../models');

// Same ownership check, and the same 404, as the ticket routes -- see
// src/services/ticketAccessService.js. It goes through the ticket provider
// (not a direct Ticket.findByPk), so comments still resolve their ticket
// when TICKET_PROVIDER points at a real CRM -- see docs/PROVIDERS.md.
// Throws a 404, handled by catchAsync.
async function loadAccessibleTicket(req) {
  return findAccessibleTicket(req.user, req.params.ticketId);
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

    // The first agent/admin comment is the ticket's first response, which
    // stops the response-target clock.
    const isStaff =
      req.user.role === 'agent' ||
      req.user.role === 'admin';

    if (
      isStaff &&
      !ticket.firstRespondedAt &&
      Number(ticket.requesterId) !== Number(req.user.id)
    ) {
      await getProvider().updateTicket(ticket.id, {
        firstRespondedAt: comment.createdAt,
      });
    }

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