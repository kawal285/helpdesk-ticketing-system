const express = require('express');
const catchAsync = require('../utils/catchAsync');

const router = express.Router();

router.get(
  '/',
  catchAsync(async (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  })
);

module.exports = router;
