const express = require('express');
const { createUser, listUsers, updateRole, deactivateUser, activateUser } = require('../controllers/user.controller');
const { createUserValidator, updateRoleValidator, userIdValidator } = require('../validators/user.validators');
const validate = require('../middleware/validate');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(protect, authorize('admin'));

router.post('/', createUserValidator, validate, createUser);
router.get('/', listUsers);
router.patch('/:id/role', updateRoleValidator, validate, updateRole);
router.patch('/:id/deactivate', userIdValidator, validate, deactivateUser);
router.patch('/:id/activate', userIdValidator, validate, activateUser);

module.exports = router;
