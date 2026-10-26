const { body } = require('express-validator');
const { CATEGORIES } = require('../utils/ticketFields');

const saveWebResultValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('title is required')
    .isLength({ max: 255 })
    .withMessage('title must be 255 characters or fewer'),
  body('url')
    .trim()
    .notEmpty()
    .withMessage('url is required')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('url must be a valid http(s) address'),
  body('snippet').optional().trim(),
  body('category')
    .optional()
    .isIn(CATEGORIES)
    .withMessage(`category must be one of ${CATEGORIES.join(', ')}`),
];

module.exports = { saveWebResultValidator };
