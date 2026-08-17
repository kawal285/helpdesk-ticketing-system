const { body, param } = require('express-validator');

const ticketIdParamValidator = [param('ticketId').isInt().withMessage('ticketId must be an integer')];

const createCommentValidator = [
  param('ticketId').isInt().withMessage('ticketId must be an integer'),
  body('text').trim().notEmpty().withMessage('text is required'),
];

module.exports = { ticketIdParamValidator, createCommentValidator };
