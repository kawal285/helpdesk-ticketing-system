const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { User } = require('../models');

module.exports = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('You are not logged in. Please log in to access this resource.', 401));
  }

  const token = header.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const user = await User.findByPk(decoded.id);
  if (!user || !user.isActive) {
    return next(new AppError('The user belonging to this token no longer exists or is deactivated.', 401));
  }

  req.user = user;
  next();
});
