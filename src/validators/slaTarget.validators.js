const { body, param } = require('express-validator');
const { PRIORITIES } = require('../utils/ticketFields');

// One year, as a sanity ceiling.
const MAX_MINUTES = 365 * 24 * 60;

const updateSlaTargetValidator = [
  param('priority')
    .isIn(PRIORITIES)
    .withMessage(`priority must be one of ${PRIORITIES.join(', ')}`),
  body('responseMinutes')
    .isInt({ min: 1, max: MAX_MINUTES })
    .withMessage(`responseMinutes must be a whole number between 1 and ${MAX_MINUTES}`)
    .toInt(),
  body('resolutionMinutes')
    .isInt({ min: 1, max: MAX_MINUTES })
    .withMessage(`resolutionMinutes must be a whole number between 1 and ${MAX_MINUTES}`)
    .toInt()
    .custom((value, { req }) => value > Number(req.body.responseMinutes))
    .withMessage('resolutionMinutes must be longer than responseMinutes'),
];

module.exports = { updateSlaTargetValidator };
