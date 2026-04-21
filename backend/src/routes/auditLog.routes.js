const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const auditLogController = require('../controllers/auditLog.controller');
const { auditLogListQuerySchema } = require('../validators/auditLog.validation');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  authorize(ROLE_NAMES.ADMIN),
  validate(auditLogListQuerySchema),
  asyncHandler(auditLogController.getAuditLogs),
);

module.exports = router;
