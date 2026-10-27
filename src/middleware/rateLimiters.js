const rateLimit = require('express-rate-limit');

// Rate limiting only applies in production so the test suite and local dev
// can hit auth/AI routes repeatedly without tripping limits meant for real traffic.
const skipOutsideProd = () => process.env.NODE_ENV !== 'production';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProd,
  message: { status: 'fail', message: 'Too many attempts. Please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProd,
  message: { status: 'fail', message: 'Too many AI analysis requests. Please try again later.' },
});

// Every call here triggers a real embedding request and writes to the
// knowledge-base file and kb_chunks, so it shares aiLimiter's profile
// (an external/local AI call plus persistent writes) even though it's a
// different route -- its own message keeps the two distinguishable in
// logs and in what the caller is told.
const kbWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProd,
  message: { status: 'fail', message: 'Too many knowledge-base saves. Please try again later.' },
});

module.exports = { authLimiter, aiLimiter, kbWriteLimiter };
