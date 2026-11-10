const catchAsync = require('../utils/catchAsync');
const { getTargets, updateTarget } = require('../services/slaTargetService');

const listSlaTargets = catchAsync(async (req, res) => {
  res.status(200).json({ targets: await getTargets() });
});

// Applies to tickets created (or re-prioritised) from now on. Existing
// tickets keep the deadlines they were given.
const updateSlaTarget = catchAsync(async (req, res) => {
  const target = await updateTarget(req.params.priority, {
    responseMinutes: req.body.responseMinutes,
    resolutionMinutes: req.body.resolutionMinutes,
  });
  res.status(200).json({ target });
});

module.exports = { listSlaTargets, updateSlaTarget };
