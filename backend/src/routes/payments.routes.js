const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const paymentsController = require('../controllers/payments.controller');
const {
  customerBuyBtnSchema,
  customerSellBtnSchema,
  customerTransferBtnSchema,
  customerPaymentReferenceParamSchema,
  paymentGatewayAccountAuthSchema,
  paymentCallbackSchema,
  paymentGatewayManagedRequestSchema,
  paymentGatewaySignedRequestSchema,
  paymentGatewaySignatureSchema,
  paymentGatewaySignKeySchema,
  paymentGatewayTokenSchema,
  paymentReferenceLookupSchema,
  paymentStatusVerifySchema,
} = require('../validators/payments.validation');

const router = express.Router();

router.post(
  '/callback',
  validate(paymentCallbackSchema),
  asyncHandler(paymentsController.ingestPaymentCallback),
);

router.post(
  '/gateway/token',
  validate(paymentGatewayTokenSchema),
  asyncHandler(paymentsController.fetchGatewayAuthorizationToken),
);

router.post(
  '/gateway/sign-key',
  validate(paymentGatewaySignKeySchema),
  asyncHandler(paymentsController.fetchGatewaySigningKey),
);

router.post(
  '/gateway/signature',
  validate(paymentGatewaySignatureSchema),
  asyncHandler(paymentsController.generateGatewaySignature),
);

router.post(
  '/gateway/account-auth/pull-payment',
  validate(paymentGatewayAccountAuthSchema),
  asyncHandler(paymentsController.authorizeGatewayPullPayment),
);

router.post(
  '/gateway/debit-request/pull-payment',
  validate(paymentGatewayAccountAuthSchema),
  asyncHandler(paymentsController.createGatewayDebitRequest),
);

router.post(
  '/gateway/beneficiary/account-inquiry',
  validate(paymentGatewaySignedRequestSchema),
  asyncHandler(paymentsController.inquireGatewayBeneficiaryAccount),
);

router.post(
  '/gateway/initiate/transaction',
  validate(paymentGatewaySignedRequestSchema),
  asyncHandler(paymentsController.initiateGatewayIntraTransaction),
);

router.post(
  '/gateway/transaction/status',
  validate(paymentGatewaySignedRequestSchema),
  asyncHandler(paymentsController.getGatewayTransactionStatusForToday),
);

router.post(
  '/gateway/transactions/status',
  validate(paymentGatewaySignedRequestSchema),
  asyncHandler(paymentsController.getGatewayTransactionStatusForHistory),
);

router.use(authMiddleware);

router.post(
  '/customer/buy-btn',
  validate(customerBuyBtnSchema),
  asyncHandler(paymentsController.initiateCustomerBuyBtn),
);

router.post(
  '/customer/sell-btn',
  validate(customerSellBtnSchema),
  asyncHandler(paymentsController.initiateCustomerSellBtn),
);

router.post(
  '/customer/transfer-btn',
  validate(customerTransferBtnSchema),
  asyncHandler(paymentsController.initiateCustomerTransferBtn),
);

router.get(
  '/customer/:paymentReference',
  validate(customerPaymentReferenceParamSchema),
  asyncHandler(paymentsController.getCustomerPaymentTransaction),
);

router.post(
  '/customer/:paymentReference/verify-status',
  validate(customerPaymentReferenceParamSchema),
  asyncHandler(paymentsController.verifyCustomerPaymentStatus),
);

router.post(
  '/pull-payment/authorize',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(paymentGatewayManagedRequestSchema),
  asyncHandler(paymentsController.authorizePullPayment),
);

router.post(
  '/pull-payment/debit',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(paymentGatewayManagedRequestSchema),
  asyncHandler(paymentsController.debitPullPayment),
);

router.post(
  '/beneficiary/account-inquiry',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(paymentGatewayManagedRequestSchema),
  asyncHandler(paymentsController.beneficiaryAccountInquiry),
);

router.post(
  '/intra/initiate',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(paymentGatewayManagedRequestSchema),
  asyncHandler(paymentsController.initiateIntraTransaction),
);

router.post(
  '/status/current',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(paymentGatewayManagedRequestSchema),
  asyncHandler(paymentsController.getCurrentPaymentStatus),
);

router.post(
  '/status/history',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(paymentGatewayManagedRequestSchema),
  asyncHandler(paymentsController.getHistoricalPaymentStatus),
);

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
