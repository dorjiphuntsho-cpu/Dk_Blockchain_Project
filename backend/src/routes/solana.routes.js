const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const solanaController = require('../controllers/solana.controller');
const {
  addCheckerSchema,
  createTokenMintSchema,
  recordCreatedTokenMintSchema,
  removeCheckerSchema,
  setAdminSchema,
  solanaConfigStatusSchema,
} = require('../validators/solana.validation');

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(ROLE_NAMES.ADMIN));

router.get('/config-status', validate(solanaConfigStatusSchema), asyncHandler(solanaController.getConfigStatus));
router.get('/prepare/mint-creation', validate(solanaConfigStatusSchema), asyncHandler(solanaController.prepareMintCreation));
router.post('/token-mints/record', validate(recordCreatedTokenMintSchema), asyncHandler(solanaController.recordCreatedTokenMint));
router.post('/token-mints', validate(createTokenMintSchema), asyncHandler(solanaController.createTokenMint));
router.post('/checkers', validate(addCheckerSchema), asyncHandler(solanaController.addChecker));
router.delete('/checkers/:checkerAddress', validate(removeCheckerSchema), asyncHandler(solanaController.removeChecker));
router.post('/admin', validate(setAdminSchema), asyncHandler(solanaController.setAdmin));

module.exports = router;
