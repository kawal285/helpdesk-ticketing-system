const express = require('express');
const { listSlaTargets, updateSlaTarget } = require('../controllers/slaTarget.controller');
const { updateSlaTargetValidator } = require('../validators/slaTarget.validators');
const validate = require('../middleware/validate');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(protect);

// Any signed-in user may read the targets; only an admin may change them.
router.get('/', listSlaTargets);
router.put('/:priority', authorize('admin'), updateSlaTargetValidator, validate, updateSlaTarget);

module.exports = router;
