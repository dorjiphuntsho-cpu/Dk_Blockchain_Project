const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const bankController = require('../controllers/bank.controller');
const {
  listBanksQuerySchema,
  bankIdParamSchema,
  bankAccountIdParamSchema,
  bankTokenAccountIdParamSchema,
  updateBankSchema,
  createBankAccountSchema,
  updateBankAccountSchema,
  createBankTokenAccountSchema,
  updateBankTokenAccountSchema,
} = require('../validators/bank.validation');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(listBanksQuerySchema),
  asyncHandler(bankController.getBanks),
);
router.get(
  '/:id',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(bankIdParamSchema),
  asyncHandler(bankController.getBankById),
);
router.patch('/:id', authorize(ROLE_NAMES.ADMIN), validate(updateBankSchema), asyncHandler(bankController.updateBank));
router.post('/:id/accounts', authorize(ROLE_NAMES.ADMIN), validate(createBankAccountSchema), asyncHandler(bankController.createBankAccount));
router.patch('/:id/accounts/:accountId', authorize(ROLE_NAMES.ADMIN), validate(updateBankAccountSchema), asyncHandler(bankController.updateBankAccount));
router.post('/:id/token-accounts', authorize(ROLE_NAMES.ADMIN), validate(createBankTokenAccountSchema), asyncHandler(bankController.createBankTokenAccount));
router.patch(
  '/:id/token-accounts/:tokenAccountId',
  authorize(ROLE_NAMES.ADMIN),
  validate(updateBankTokenAccountSchema),
  asyncHandler(bankController.updateBankTokenAccount),
);

module.exports = router;
