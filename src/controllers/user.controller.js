const bcrypt = require('bcryptjs');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { User } = require('../models');
const { sanitizeUser } = require('./auth.controller');

// Admin-only: create an agent or admin account. This is the only way
// non-customer accounts come into existence (self-registration always
// forces role=customer -- see auth.controller.js).
const createUser = catchAsync(async (req, res) => {
  const { name, email, password, role } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role });
  res.status(201).json({ user: sanitizeUser(user) });
});

const listUsers = catchAsync(async (req, res) => {
  const where = {};
  if (req.query.role) where.role = req.query.role;

  const users = await User.findAll({ where, order: [['createdAt', 'DESC']] });
  res.status(200).json({ users: users.map(sanitizeUser) });
});

const updateRole = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));

  user.role = req.body.role;
  await user.save();
  res.status(200).json({ user: sanitizeUser(user) });
});

const deactivateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));

  user.isActive = false;
  await user.save();
  res.status(200).json({ user: sanitizeUser(user) });
});

const activateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));

  user.isActive = true;
  await user.save();
  res.status(200).json({ user: sanitizeUser(user) });
});

module.exports = { createUser, listUsers, updateRole, deactivateUser, activateUser };
