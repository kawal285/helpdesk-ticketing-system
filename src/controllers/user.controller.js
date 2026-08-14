const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { User, Ticket } = require('../models');
const { sanitizeUser } = require('./auth.controller');

// A ticket assigned to an agent who can no longer act on it (deactivated, or
// no longer an agent) would otherwise sit invisible to everyone but an admin
// -- other agents' scope only includes tickets assigned to them or
// unassigned. Freeing it here returns it to the unassigned pool immediately.
async function unassignOpenTickets(agentId) {
  await Ticket.update(
    { assigneeId: null },
    { where: { assigneeId: agentId, status: { [Op.in]: ['Open', 'In Progress'] } } }
  );
}

// Guards against locking the system out of admin access entirely -- nothing
// else can recover from zero active admins, since every admin-only endpoint
// (including this one) requires being logged in as one.
async function isLastActiveAdmin(user) {
  if (user.role !== 'admin' || !user.isActive) return false;
  const otherActiveAdmins = await User.count({
    where: { role: 'admin', isActive: true, id: { [Op.ne]: user.id } },
  });
  return otherActiveAdmins === 0;
}

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

  if (req.body.role !== 'admin' && (await isLastActiveAdmin(user))) {
    return next(new AppError('Cannot change the role of the last active admin.', 400));
  }

  const wasAgent = user.role === 'agent';
  user.role = req.body.role;
  await user.save();

  if (wasAgent && user.role !== 'agent') {
    await unassignOpenTickets(user.id);
  }

  res.status(200).json({ user: sanitizeUser(user) });
});

const deactivateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));

  if (await isLastActiveAdmin(user)) {
    return next(new AppError('Cannot deactivate the last active admin.', 400));
  }

  user.isActive = false;
  await user.save();

  if (user.role === 'agent') {
    await unassignOpenTickets(user.id);
  }

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
