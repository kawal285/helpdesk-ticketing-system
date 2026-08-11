const AppError = require('../utils/appError');

function handleSequelizeValidationError(err) {
  const message = err.errors.map((e) => e.message).join('. ');
  return new AppError(`Invalid input data. ${message}`, 400);
}

function handleSequelizeUniqueConstraintError(err) {
  const message = err.errors.map((e) => `${e.path} must be unique`).join('. ');
  return new AppError(message, 409);
}

function handleJwtError() {
  return new AppError('Invalid token. Please log in again.', 401);
}

function handleJwtExpiredError() {
  return new AppError('Your token has expired. Please log in again.', 401);
}

module.exports = function errorHandler(err, req, res, next) {
  let error = err;

  if (error.name === 'SequelizeValidationError') error = handleSequelizeValidationError(error);
  if (error.name === 'SequelizeUniqueConstraintError') error = handleSequelizeUniqueConstraintError(error);
  if (error.name === 'JsonWebTokenError') error = handleJwtError();
  if (error.name === 'TokenExpiredError') error = handleJwtExpiredError();

  const statusCode = error.statusCode || 500;
  const status = error.status || 'error';

  if (!error.isOperational) {
    console.error('UNEXPECTED ERROR:', err);
  }

  res.status(statusCode).json({
    status,
    message: error.isOperational ? error.message : 'Something went wrong.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
