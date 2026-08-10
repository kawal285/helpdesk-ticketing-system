const { body, param } = require('express-validator');

const createUserValidator = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('email').trim().isEmail().withMessage('a valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('password must be at least 8 characters long'),
  body('role')
    .isIn(['agent', 'admin'])
    .withMessage('role must be either agent or admin'),
];

const updateRoleValidator = [
  param('id').isInt().withMessage('id must be an integer'),
  body('role').isIn(['admin', 'agent', 'customer']).withMessage('invalid role'),
];

const userIdValidator = [param('id').isInt().withMessage('id must be an integer')];

module.exports = { createUserValidator, updateRoleValidator, userIdValidator };
