const { body } = require('express-validator');
const { ORGANIZATIONS } = require('../utils/organizations');

const registerValidator = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('email').trim().isEmail().withMessage('a valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('password must be at least 8 characters long'),
  body('organization')
    .optional()
    .isIn(ORGANIZATIONS)
    .withMessage(`organization must be one of ${ORGANIZATIONS.join(', ')}`),
];

const loginValidator = [
  body('email').trim().isEmail().withMessage('a valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('password is required'),
];

module.exports = { registerValidator, loginValidator };
