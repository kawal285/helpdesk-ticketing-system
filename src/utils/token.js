'use strict';

const jwt = require('jsonwebtoken');

// A signed token is a tamper-proof way of saying "this request is from user X".
// It is NOT a permissions system by itself -- just proof of identity.
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

module.exports = { signToken };
