const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const cbsController = require('../controllers/cbs.controller');
const { cbsAccountInquirySchema } = require('../validators/cbs.validation');

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/account-inquiry',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(cbsAccountInquirySchema),
  asyncHandler(cbsController.accountInquiry),
);

router.get(
  '/issuer-reserve-balance',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  asyncHandler(cbsController.issuerReserveBalance),
);

module.exports = router;
