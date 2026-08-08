const rateLimit = require('express-rate-limit');

// Rate limiting is disabled under test so the suite can hit auth/AI routes
// repeatedly across scenarios without tripping limits meant for real traffic.
const skipInTest = () => process.env.NODE_ENV === 'test';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { status: 'fail', message: 'Too many attempts. Please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { status: 'fail', message: 'Too many AI analysis requests. Please try again later.' },
});

module.exports = { authLimiter, aiLimiter };
