const { body } = require('express-validator');

const registerValidator = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('email').trim().isEmail().withMessage('a valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('password must be at least 8 characters long'),
];

const loginValidator = [
  body('email').trim().isEmail().withMessage('a valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('password is required'),
];

module.exports = { registerValidator, loginValidator };
