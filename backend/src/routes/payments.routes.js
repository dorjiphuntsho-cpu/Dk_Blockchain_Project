const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const paymentsController = require('../controllers/payments.controller');
const {
  paymentCallbackSchema,
  paymentReferenceLookupSchema,
  paymentStatusVerifySchema,
} = require('../validators/payments.validation');

const router = express.Router();

router.post(
  '/callback',
  validate(paymentCallbackSchema),
  asyncHandler(paymentsController.ingestPaymentCallback),
);

router.use(authMiddleware);

router.get(
  '/:paymentReference',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(paymentReferenceLookupSchema),
  asyncHandler(paymentsController.getPaymentTransaction),
);

router.post(
  '/:paymentReference/verify-status',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(paymentStatusVerifySchema),
  asyncHandler(paymentsController.verifyPaymentStatus),
);

module.exports = router;
