const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const walletController = require('../controllers/wallet.controller');
const {
  createWalletSchema,
  listWalletsQuerySchema,
  updateWalletSchema,
  updateWalletStatusSchema,
  walletIdParamSchema,
} = require('../validators/wallet.validation');

const router = express.Router();

router.use(authMiddleware);

router.post('/', authorize(ROLE_NAMES.ADMIN), validate(createWalletSchema), asyncHandler(walletController.createWallet));
router.get(
  '/',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(listWalletsQuerySchema),
  asyncHandler(walletController.getWallets),
);
router.get(
  '/:id',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(walletIdParamSchema),
  asyncHandler(walletController.getWalletById),
);
router.get(
  '/:id/token-balances',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(walletIdParamSchema),
  asyncHandler(walletController.getWalletTokenBalances),
);
router.patch('/:id', authorize(ROLE_NAMES.ADMIN), validate(updateWalletSchema), asyncHandler(walletController.updateWallet));
router.patch(
  '/:id/status',
  authorize(ROLE_NAMES.ADMIN),
  validate(updateWalletStatusSchema),
  asyncHandler(walletController.updateWalletStatus),
);

module.exports = router;
