const express = require('express');
const { createComment, listComments } = require('../controllers/comment.controller');
const { createCommentValidator, ticketIdParamValidator } = require('../validators/comment.validators');
const validate = require('../middleware/validate');
const protect = require('../middleware/protect');

const router = express.Router({ mergeParams: true });

router.use(protect);

router.post('/', createCommentValidator, validate, createComment);
router.get('/', ticketIdParamValidator, validate, listComments);

module.exports = router;
