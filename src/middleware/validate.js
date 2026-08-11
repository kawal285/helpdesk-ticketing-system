const { validationResult } = require('express-validator');
const AppError = require('../utils/appError');

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const message = errors
    .array()
    .map((e) => `${e.path}: ${e.msg}`)
    .join('. ');

  next(new AppError(message, 400));
};
