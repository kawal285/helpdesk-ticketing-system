const express = require('express');
const { body, query } = require('express-validator');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { knowledgeGapReport, markCovered } = require('../services/knowledgeGapService');

const router = express.Router();

// The knowledge-gap report is for admins, who decide which articles to
// write next.
router.use(protect, authorize('admin'));

router.get(
  '/',
  [
    query('days').optional().isInt({ min: 1, max: 365 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('includeCovered').optional().isIn(['true', 'false']),
  ],
  validate,
  catchAsync(async (req, res, next) => {
    try {
      const report = await knowledgeGapReport({
        days: req.query.days || undefined,
        limit: req.query.limit || undefined,
        includeCovered: req.query.includeCovered === 'true',
      });
      res.status(200).json({ report });
    } catch (error) {
      console.warn(`[knowledge-gaps] report failed: ${error.message}`);
      return next(new AppError('The knowledge-gap report is unavailable right now.', 503));
    }
  })
);

// Marks a topic as covered once an article exists for it.
router.post(
  '/cover',
  [
    body('interactionIds')
      .isArray({ min: 1, max: 1000 })
      .withMessage('interactionIds must be a non-empty list'),
    body('interactionIds.*').isInt({ min: 1 }).toInt(),
    body('articleId').optional({ nullable: true }).isString().isLength({ max: 100 }),
  ],
  validate,
  catchAsync(async (req, res) => {
    const updated = await markCovered(req.body.interactionIds, req.user, req.body.articleId);
    res.status(200).json({ updated });
  })
);

module.exports = router;
