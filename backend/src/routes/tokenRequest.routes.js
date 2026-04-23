const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const tokenRequestController = require('../controllers/tokenRequest.controller');
const {
  createTokenRequestSchema,
  listTokenRequestsQuerySchema,
  tokenRequestIdParamSchema,
  updateTokenRequestSchema,
  recordInitiationSchema,
  recordExecutionSchema,
} = require('../validators/tokenRequest.validation');

const router = express.Router();

router.use(authMiddleware);

router.post('/', authorize(ROLE_NAMES.MAKER), validate(createTokenRequestSchema), asyncHandler(tokenRequestController.createTokenRequest));
router.get(
  '/',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(listTokenRequestsQuerySchema),
  asyncHandler(tokenRequestController.getTokenRequests),
);
router.get(
  '/:id',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(tokenRequestIdParamSchema),
  asyncHandler(tokenRequestController.getTokenRequestById),
);
router.patch(
  '/:id',
  authorize(ROLE_NAMES.MAKER),
  validate(updateTokenRequestSchema),
  asyncHandler(tokenRequestController.updateTokenRequest),
);
router.post(
  '/:id/submit',
  authorize(ROLE_NAMES.MAKER),
  validate(tokenRequestIdParamSchema),
  asyncHandler(tokenRequestController.submitTokenRequest),
);
router.post(
  '/:id/mark-ready',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.EXECUTOR),
  validate(tokenRequestIdParamSchema),
  asyncHandler(tokenRequestController.markReadyForExecution),
);
router.get(
  '/:id/execution-payload',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(tokenRequestIdParamSchema),
  asyncHandler(tokenRequestController.prepareExecution),
);
router.get(
  '/:id/prepare/mint-request',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(tokenRequestIdParamSchema),
  asyncHandler(tokenRequestController.prepareMintRequest),
);
router.get(
  '/:id/prepare/transfer-request',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(tokenRequestIdParamSchema),
  asyncHandler(tokenRequestController.prepareTransferRequest),
);
router.get(
  '/:id/prepare/burn-request',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER),
  validate(tokenRequestIdParamSchema),
  asyncHandler(tokenRequestController.prepareBurnRequest),
);
router.get(
  '/:id/prepare/checker-approval',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER),
  validate(tokenRequestIdParamSchema),
  asyncHandler(tokenRequestController.prepareCheckerApproval),
);
router.get(
  '/:id/prepare/checker-rejection',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER),
  validate(tokenRequestIdParamSchema),
  asyncHandler(tokenRequestController.prepareCheckerRejection),
);
router.post(
  '/:id/record-initiation',
  authorize(ROLE_NAMES.MAKER),
  validate(recordInitiationSchema),
  asyncHandler(tokenRequestController.recordInitiation),
);
router.post(
  '/:id/execute',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.EXECUTOR),
  validate(tokenRequestIdParamSchema),
  asyncHandler(tokenRequestController.executeReadyRequest),
);
router.post(
  '/:id/record-execution',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(recordExecutionSchema),
  asyncHandler(tokenRequestController.recordExecution),
);

module.exports = router;
