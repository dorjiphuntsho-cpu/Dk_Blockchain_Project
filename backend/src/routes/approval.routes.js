const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const approvalController = require('../controllers/approval.controller');
const { approveSchema, rejectSchema } = require('../validators/approval.validation');

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(ROLE_NAMES.CHECKER));

router.post('/:id/approve', validate(approveSchema), asyncHandler(approvalController.approveTokenRequest));
router.post('/:id/reject', validate(rejectSchema), asyncHandler(approvalController.rejectTokenRequest));

module.exports = router;
