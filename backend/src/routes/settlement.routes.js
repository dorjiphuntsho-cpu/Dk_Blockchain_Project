const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const settlementController = require('../controllers/settlement.controller');
const {
  createReserveMintRequestSchema,
  createReplenishmentMintRequestSchema,
  createInterbankTransferRequestSchema,
  createRedemptionRequestSchema,
  listSettlementsQuerySchema,
  settlementIdParamSchema,
  approveSettlementSchema,
  rejectSettlementSchema,
  settlementMakerPreparationQuerySchema,
  settlementCheckerPreparationQuerySchema,
  settlementRecordInitiationSchema,
  settlementRecordExecutionSchema,
  reconcileSettlementSchema,
  reconcilePendingSettlementsSchema,
} = require('../validators/settlement.validation');

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/reconcile-pending',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.EXECUTOR),
  validate(reconcilePendingSettlementsSchema),
  asyncHandler(settlementController.reconcilePendingSettlements),
);
router.post(
  '/reserve-mint',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(createReserveMintRequestSchema),
  asyncHandler(settlementController.createReserveMintRequest),
);
router.post(
  '/replenishment-mint',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(createReplenishmentMintRequestSchema),
  asyncHandler(settlementController.createReplenishmentMintRequest),
);
router.post(
  '/interbank-transfer',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(createInterbankTransferRequestSchema),
  asyncHandler(settlementController.createInterbankTransferRequest),
);
router.post(
  '/redemptions',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(createRedemptionRequestSchema),
  asyncHandler(settlementController.createRedemptionRequest),
);
router.get(
  '/',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(listSettlementsQuerySchema),
  asyncHandler(settlementController.getSettlements),
);
router.get(
  '/:id',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(settlementIdParamSchema),
  asyncHandler(settlementController.getSettlementById),
);
router.get(
  '/:id/prepare/mint-request',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(settlementMakerPreparationQuerySchema),
  asyncHandler(settlementController.prepareMintSettlementRequest),
);
router.get(
  '/:id/prepare/transfer-request',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(settlementMakerPreparationQuerySchema),
  asyncHandler(settlementController.prepareTransferSettlementRequest),
);
router.get(
  '/:id/prepare/burn-request',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(settlementMakerPreparationQuerySchema),
  asyncHandler(settlementController.prepareBurnSettlementRequest),
);
router.get(
  '/:id/prepare/checker-approval',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER),
  validate(settlementCheckerPreparationQuerySchema),
  asyncHandler(settlementController.prepareMintSettlementCheckerApproval),
);
router.get(
  '/:id/prepare/checker-transfer-approval',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER),
  validate(settlementCheckerPreparationQuerySchema),
  asyncHandler(settlementController.prepareTransferSettlementCheckerApproval),
);
router.get(
  '/:id/prepare/checker-burn-approval',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER),
  validate(settlementCheckerPreparationQuerySchema),
  asyncHandler(settlementController.prepareBurnSettlementCheckerApproval),
);
router.post(
  '/:id/record-initiation',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(settlementRecordInitiationSchema),
  asyncHandler(settlementController.recordMintSettlementInitiation),
);
router.post(
  '/:id/record-transfer-initiation',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(settlementRecordInitiationSchema),
  asyncHandler(settlementController.recordTransferSettlementInitiation),
);
router.post(
  '/:id/record-burn-initiation',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(settlementRecordInitiationSchema),
  asyncHandler(settlementController.recordBurnSettlementInitiation),
);
router.post(
  '/:id/record-execution',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(settlementRecordExecutionSchema),
  asyncHandler(settlementController.recordMintSettlementExecution),
);
router.post(
  '/:id/record-transfer-execution',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(settlementRecordExecutionSchema),
  asyncHandler(settlementController.recordTransferSettlementExecution),
);
router.post(
  '/:id/run-inquiry',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.EXECUTOR),
  validate(settlementIdParamSchema),
  asyncHandler(settlementController.runSettlementInquiry),
);
router.post(
  '/:id/record-burn-execution',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(settlementRecordExecutionSchema),
  asyncHandler(settlementController.recordBurnSettlementExecution),
);
router.post(
  '/:id/reconcile',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.EXECUTOR),
  validate(reconcileSettlementSchema),
  asyncHandler(settlementController.reconcileSettlement),
);
router.post(
  '/:id/route',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.EXECUTOR),
  validate(settlementIdParamSchema),
  asyncHandler(settlementController.routeSettlement),
);
router.post(
  '/:id/approve',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER),
  validate(approveSettlementSchema),
  asyncHandler(settlementController.approveSettlement),
);
router.post(
  '/:id/reject',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER),
  validate(rejectSettlementSchema),
  asyncHandler(settlementController.rejectSettlement),
);
router.post(
  '/:id/mark-ready',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.EXECUTOR),
  validate(settlementIdParamSchema),
  asyncHandler(settlementController.markSettlementReadyForExecution),
);
router.post(
  '/:id/execute',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.EXECUTOR),
  validate(settlementIdParamSchema),
  asyncHandler(settlementController.executeSettlement),
);

module.exports = router;
