'use strict';

const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { signToken } = require('../utils/token');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// User.create() returns an instance carrying every attribute you set on it,
// including passwordHash -- the model's defaultScope only excludes that
// column from SELECT-based queries (findOne/findAll), not from an instance
// built in memory. Strip it before any user object goes into a response.
function sanitizeUser(user) {
  const json = user.toJSON();
  delete json.passwordHash;
  return json;
}

// POST /auth/register
const register = catchAsync(async (req, res, next) => {
  const { name, email, password, organization } = req.body;

  if (!name || !email || !password) {
    return next(new AppError('name, email and password are required.', 400));
  }
  if (password.length < 8) {
    return next(new AppError('Password must be at least 8 characters.', 400));
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return next(new AppError('An account with that email already exists.', 400));
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    name,
    email,
    passwordHash,
    organization: organization || 'Future Skills',
  });

  const token = signToken(user.id);
  res.status(201).json({ status: 'success', token, data: { user: sanitizeUser(user) } });
});

// POST /auth/login
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('email and password are required.', 400));
  }

  const user = await User.scope('withPassword').findOne({ where: { email } });

  const passwordCorrect = user && (await bcrypt.compare(password, user.passwordHash));

  if (!passwordCorrect) {
    return next(new AppError('Incorrect email or password.', 401));
  }
  if (!user.isActive) {
    return next(new AppError('This account has been deactivated.', 401));
  }

  const token = signToken(user.id);
  res.status(200).json({ status: 'success', token, data: { user: sanitizeUser(user) } });
});

// GET /auth/me
async function getMe(req, res) {
  res.status(200).json({ status: 'success', data: { user: req.user } });
}

module.exports = { register, login, getMe, sanitizeUser };
