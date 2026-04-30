const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const bipsController = require('../controllers/bips.controller');
const {
  accountInquirySchema,
  outgoingSchema,
  pgStatusQuerySchema,
  liveInquiryQuerySchema,
} = require('../validators/bips.validation');

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(ROLE_NAMES.ADMIN));

router.post('/account-inquiry', validate(accountInquirySchema), asyncHandler(bipsController.accountInquiry));
router.post('/outgoing', validate(outgoingSchema), asyncHandler(bipsController.outgoingTransfer));
router.get('/status', validate(pgStatusQuerySchema), asyncHandler(bipsController.getPgStatus));
router.get('/live-inquiry', validate(liveInquiryQuerySchema), asyncHandler(bipsController.liveInquiry));

module.exports = router;
