const { body, param, query } = require('express-validator');
const { CATEGORIES, PRIORITIES } = require('../utils/ticketFields');
const { STATUSES } = require('../utils/ticketStatus');

const createTicketValidator = [
  body('title').trim().notEmpty().withMessage('title is required'),
  body('description').trim().notEmpty().withMessage('description is required'),
  body('category').optional().isIn(CATEGORIES).withMessage(`category must be one of ${CATEGORIES.join(', ')}`),
  body('priority').optional().isIn(PRIORITIES).withMessage(`priority must be one of ${PRIORITIES.join(', ')}`),
];

const listTicketsValidator = [
  query('status').optional().isIn(STATUSES).withMessage(`status must be one of ${STATUSES.join(', ')}`),
  query('priority').optional().isIn(PRIORITIES).withMessage(`priority must be one of ${PRIORITIES.join(', ')}`),
  query('category').optional().isIn(CATEGORIES).withMessage(`category must be one of ${CATEGORIES.join(', ')}`),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

const ticketIdValidator = [param('id').isInt().withMessage('id must be an integer')];

const updateTicketValidator = [
  param('id').isInt().withMessage('id must be an integer'),
  body('title').optional().trim().notEmpty().withMessage('title cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('description cannot be empty'),
  body('category').optional().isIn(CATEGORIES).withMessage(`category must be one of ${CATEGORIES.join(', ')}`),
  body('priority').optional().isIn(PRIORITIES).withMessage(`priority must be one of ${PRIORITIES.join(', ')}`),
];

const updateTicketStatusValidator = [
  param('id').isInt().withMessage('id must be an integer'),
  body('status').isIn(STATUSES).withMessage(`status must be one of ${STATUSES.join(', ')}`),
];

const assignTicketValidator = [
  param('id').isInt().withMessage('id must be an integer'),
  body('assigneeId')
    .exists({ checkNull: false })
    .withMessage('assigneeId is required (an integer, or null to unassign)')
    .custom((value) => value === null || Number.isInteger(value))
    .withMessage('assigneeId must be an integer or null'),
];

module.exports = {
  createTicketValidator,
  listTicketsValidator,
  ticketIdValidator,
  updateTicketValidator,
  updateTicketStatusValidator,
  assignTicketValidator,
};
