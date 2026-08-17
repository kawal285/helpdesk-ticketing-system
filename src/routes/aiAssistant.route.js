const express = require('express');
const {
  askAssistant,
} = require('../controllers/aiAssistant.controller');
const protect = require('../middleware/protect');
const {
  aiLimiter,
} = require('../middleware/rateLimiters');

const router = express.Router();

router.use(protect);

router.post('/assist', aiLimiter, askAssistant);

module.exports = router;