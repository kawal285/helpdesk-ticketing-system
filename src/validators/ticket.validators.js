const { body, param, query } = require('express-validator');
const {
  CATEGORIES,
  PRIORITIES,
  DEFAULT_PRIORITY,
  LEVEL_PRIORITIES,
} = require('../utils/ticketFields');
const { STATUSES } = require('../utils/ticketStatus');
const { ORGANIZATIONS } = require('../utils/organizations');

const SORTS = ['priority', 'newest'];

// A priority can be sent as its name ("High") or its level ("P2"); a level
// is stored as the matching name (P4 is stored as Low).
const priorityBody = () =>
  body('priority')
    .optional()
    .customSanitizer((value) =>
      typeof value === 'string' && LEVEL_PRIORITIES[value.trim().toUpperCase()]
        ? LEVEL_PRIORITIES[value.trim().toUpperCase()]
        : value
    )
    .isIn(PRIORITIES)
    .withMessage(`priority must be one of ${PRIORITIES.join(', ')} or P1-P4`);

const createTicketValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('title is required')
    .isLength({ max: 255 })
    .withMessage('title must be 255 characters or fewer'),
  body('description').trim().notEmpty().withMessage('description is required'),
  body('category').optional().isIn(CATEGORIES).withMessage(`category must be one of ${CATEGORIES.join(', ')}`),
  priorityBody(),
  body('room').optional().trim(),
  body('parentCaseId')
    .optional({ nullable: true })
    .isInt()
    .withMessage('parentCaseId must be an integer ticket id'),
];

const listTicketsValidator = [
  query('status').optional().isIn(STATUSES).withMessage(`status must be one of ${STATUSES.join(', ')}`),
  query('priority').optional().isIn(PRIORITIES).withMessage(`priority must be one of ${PRIORITIES.join(', ')}`),
  query('sort').optional().isIn(SORTS).withMessage(`sort must be one of ${SORTS.join(', ')}`),
  query('category').optional().isIn(CATEGORIES).withMessage(`category must be one of ${CATEGORIES.join(', ')}`),
  query('organization')
    .optional()
    .isIn(ORGANIZATIONS)
    .withMessage(`organization must be one of ${ORGANIZATIONS.join(', ')}`),
  query('assigneeId').optional().isInt().withMessage('assigneeId must be an integer'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

const ticketIdValidator = [param('id').isInt().withMessage('id must be an integer')];

const updateTicketValidator = [
  param('id').isInt().withMessage('id must be an integer'),
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('title cannot be empty')
    .isLength({ max: 255 })
    .withMessage('title must be 255 characters or fewer'),
  body('description').optional().trim().notEmpty().withMessage('description cannot be empty'),
  body('category').optional().isIn(CATEGORIES).withMessage(`category must be one of ${CATEGORIES.join(', ')}`),
  priorityBody(),
  body('status').optional().isIn(STATUSES).withMessage(`status must be one of ${STATUSES.join(', ')}`),
  body('assigneeId')
    .optional({ nullable: true })
    .custom((value) => value === null || Number.isInteger(value))
    .withMessage('assigneeId must be an integer or null'),
  body('room').optional().trim(),
  body('parentCaseId')
    .optional({ nullable: true })
    .isInt()
    .withMessage('parentCaseId must be an integer ticket id'),
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