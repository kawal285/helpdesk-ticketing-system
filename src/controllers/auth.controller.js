const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { User } = require('../models');

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

function sanitizeUser(user) {
  const { id, name, email, role, isActive, createdAt } = user;
  return { id, name, email, role, isActive, createdAt };
}

const register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  const passwordHash = await bcrypt.hash(password, 12);

  // Self-registration always creates a customer account, regardless of
  // what the client sends -- agent/admin accounts are created via the
  // admin-only /users endpoint (see Commit 4).
  const user = await User.create({ name, email, passwordHash, role: 'customer' });

  const token = signToken(user);
  res.status(201).json({ token, user: sanitizeUser(user) });
});

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ where: { email } });
  if (!user || !user.isActive) {
    return next(new AppError('Incorrect email or password.', 401));
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return next(new AppError('Incorrect email or password.', 401));
  }

  const token = signToken(user);
  res.status(200).json({ token, user: sanitizeUser(user) });
});

const getMe = catchAsync(async (req, res) => {
  res.status(200).json({ user: sanitizeUser(req.user) });
});

module.exports = { register, login, getMe, sanitizeUser };
