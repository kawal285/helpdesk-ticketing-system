const express = require('express');
const { register, login, getMe } = require('../controllers/auth.controller');
const { registerValidator, loginValidator } = require('../validators/auth.validators');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiters');
const protect = require('../middleware/protect');

const router = express.Router();

router.post('/register', authLimiter, registerValidator, validate, register);
router.post('/login', authLimiter, loginValidator, validate, login);
router.get('/me', protect, getMe);

module.exports = router;
