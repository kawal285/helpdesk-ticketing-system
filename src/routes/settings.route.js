const express = require('express');
const { getSettings, verifyEmail } = require('../controllers/settings.controller');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', getSettings);
router.post('/verify-email', verifyEmail);

module.exports = router;
