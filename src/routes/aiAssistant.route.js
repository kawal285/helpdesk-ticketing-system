
const express = require('express');
const {
  askAssistant,
} = require('../controllers/aiAssistant.controller');
const {
  classifyEmotion,
} = require('../controllers/emotionDetection.controller');
const protect = require('../middleware/protect');
const {
  aiLimiter,
} = require('../middleware/rateLimiters');

const router = express.Router();

router.use(protect);

router.post('/assist', aiLimiter, askAssistant);
router.post('/emotion', aiLimiter, classifyEmotion);

module.exports = router;
