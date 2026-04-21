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
router.post(
  '/:id/record-execution',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.EXECUTOR),
  validate(recordExecutionSchema),
  asyncHandler(tokenRequestController.recordExecution),
);

module.exports = router;
