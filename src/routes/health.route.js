const express = require('express');
const catchAsync = require('../utils/catchAsync');
const sequelize = require('../config/database');

const router = express.Router();

router.get(
  '/',
  catchAsync(async (req, res) => {
    let database = 'connected';
    try {
      await sequelize.authenticate();
    } catch (err) {
      database = 'disconnected';
    }

    res.status(200).json({
      status: 'ok',
      database,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  })
);

module.exports = router;
