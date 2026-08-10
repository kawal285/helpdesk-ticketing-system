const bcrypt = require('bcryptjs');
const { User } = require('../../src/models');
const { signToken } = require('../../src/controllers/auth.controller');

let counter = 0;
function uniqueEmail(prefix) {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@example.com`;
}

// Bypasses the register/login HTTP flow (which always forces role=customer)
// so tests can create agents/admins directly. Low bcrypt cost keeps the
// suite fast -- security of the hash doesn't matter for test fixtures.
async function createUser({ role = 'customer', name, email, password = 'Password123!', isActive = true } = {}) {
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await User.create({
    name: name || `${role} user`,
    email: email || uniqueEmail(role),
    passwordHash,
    role,
    isActive,
  });
  return user;
}

async function createUserWithToken(opts) {
  const user = await createUser(opts);
  return { user, token: signToken(user) };
}

module.exports = { createUser, createUserWithToken, uniqueEmail };
