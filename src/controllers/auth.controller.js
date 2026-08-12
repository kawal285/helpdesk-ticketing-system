'use strict';

const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { signToken } = require('../utils/token');

// POST /auth/register
async function register(req, res) {
  try {
    const { name, email, password, organization } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      passwordHash,
      organization: organization || 'Future Skills',
    });

    const token = signToken(user.id);
    res.status(201).json({ status: 'success', token, data: { user } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    const user = await User.scope('withPassword').findOne({ where: { email } });

    const passwordCorrect = user && (await bcrypt.compare(password, user.passwordHash));

    if (!passwordCorrect) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    if (!user.isActive) {
      return res.status(401).json({ error: 'This account has been deactivated.' });
    }

    user.passwordHash = undefined;

    const token = signToken(user.id);
    res.status(200).json({ status: 'success', token, data: { user } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /auth/me
async function getMe(req, res) {
  res.status(200).json({ status: 'success', data: { user: req.user } });
}

module.exports = { register, login, getMe };