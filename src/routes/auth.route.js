const express = require('express');
const { register, login, getMe, changePassword } = require('../controllers/auth.controller');
const { registerValidator, loginValidator, changePasswordValidator } = require('../validators/auth.validators');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiters');
const protect = require('../middleware/protect');

const router = express.Router();

router.post('/register', authLimiter, registerValidator, validate, register);
router.post('/login', authLimiter, loginValidator, validate, login);
router.get('/me', protect, getMe);
router.patch('/change-password', protect, authLimiter, changePasswordValidator, validate, changePassword);

module.exports = router;
