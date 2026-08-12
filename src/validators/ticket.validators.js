const { body, param, query } = require('express-validator');
const { CATEGORIES, PRIORITIES, INITIAL_FEELINGS, ORIGINS } = require('../utils/ticketFields');
const { STATUSES } = require('../utils/ticketStatus');
const { ORGANIZATIONS } = require('../utils/organizations');

const createTicketValidator = [
  body('title').trim().notEmpty().withMessage('title is required'),
  body('description').trim().notEmpty().withMessage('description is required'),
  body('category').optional().isIn(CATEGORIES).withMessage(`category must be one of ${CATEGORIES.join(', ')}`),
  body('priority').optional().isIn(PRIORITIES).withMessage(`priority must be one of ${PRIORITIES.join(', ')}`),
  body('initialFeeling')
    .optional()
    .isIn(INITIAL_FEELINGS)
    .withMessage(`initialFeeling must be one of ${INITIAL_FEELINGS.join(', ')}`),
  body('origin').optional().isIn(ORIGINS).withMessage(`origin must be one of ${ORIGINS.join(', ')}`),
  body('location').optional().trim(),
  body('studentLivingVillageResident').optional().isBoolean().withMessage('studentLivingVillageResident must be true or false'),
  body('opsvDefect').optional().isBoolean().withMessage('opsvDefect must be true or false'),
  body('parentCaseId')
    .optional({ nullable: true })
    .isInt()
    .withMessage('parentCaseId must be an integer ticket id'),
];

const listTicketsValidator = [
  query('status').optional().isIn(STATUSES).withMessage(`status must be one of ${STATUSES.join(', ')}`),
  query('priority').optional().isIn(PRIORITIES).withMessage(`priority must be one of ${PRIORITIES.join(', ')}`),
  query('category').optional().isIn(CATEGORIES).withMessage(`category must be one of ${CATEGORIES.join(', ')}`),
  query('organization')
    .optional()
    .isIn(ORGANIZATIONS)
    .withMessage(`organization must be one of ${ORGANIZATIONS.join(', ')}`),
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
  body('status').optional().isIn(STATUSES).withMessage(`status must be one of ${STATUSES.join(', ')}`),
  body('assigneeId')
    .optional({ nullable: true })
    .custom((value) => value === null || Number.isInteger(value))
    .withMessage('assigneeId must be an integer or null'),
  body('initialFeeling')
    .optional()
    .isIn(INITIAL_FEELINGS)
    .withMessage(`initialFeeling must be one of ${INITIAL_FEELINGS.join(', ')}`),
  body('origin').optional().isIn(ORIGINS).withMessage(`origin must be one of ${ORIGINS.join(', ')}`),
  body('location').optional().trim(),
  body('studentLivingVillageResident').optional().isBoolean().withMessage('studentLivingVillageResident must be true or false'),
  body('opsvDefect').optional().isBoolean().withMessage('opsvDefect must be true or false'),
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