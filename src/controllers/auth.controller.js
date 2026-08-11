'use strict';

const bcrypt = require('bcryptjs');
const { User } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { signToken: signJwt } = require('../utils/token');

function sanitizeUser(user) {
  const plain = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete plain.passwordHash;
  return plain;
}

function signToken(user) {
  return signJwt(user.id);
}

const register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return next(new AppError('An account with that email already exists.', 409));
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role: 'customer' });

  const token = signToken(user);
  res.status(201).json({ token, user: sanitizeUser(user) });
});

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.scope('withPassword').findOne({ where: { email } });
  const passwordCorrect = user && (await bcrypt.compare(password, user.passwordHash));

  if (!passwordCorrect) {
    return next(new AppError('Incorrect email or password.', 401));
  }
  if (!user.isActive) {
    return next(new AppError('This account has been deactivated.', 401));
  }

  const token = signToken(user);
  res.status(200).json({ token, user: sanitizeUser(user) });
});

const getMe = catchAsync(async (req, res) => {
  res.status(200).json({ user: sanitizeUser(req.user) });
});

module.exports = { register, login, getMe, signToken, sanitizeUser };