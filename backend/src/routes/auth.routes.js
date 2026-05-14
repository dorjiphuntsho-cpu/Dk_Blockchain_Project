const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validateMiddleware');
const authMiddleware = require('../middlewares/authMiddleware');
const authController = require('../controllers/auth.controller');
const { customerLoginSchema, loginSchema, updateCustomerBankAccountsSchema } = require('../validators/auth.validation');

const router = express.Router();

router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.post('/customer-login', validate(customerLoginSchema), asyncHandler(authController.customerLogin));
router.get('/me', authMiddleware, asyncHandler(authController.me));
router.get('/customer-portal-summary', authMiddleware, asyncHandler(authController.customerPortalSummary));
router.get('/customer-bank-options', authMiddleware, asyncHandler(authController.customerBankOptions));
router.patch(
  '/customer-bank-accounts',
  authMiddleware,
  validate(updateCustomerBankAccountsSchema),
  asyncHandler(authController.updateCustomerBankAccounts),
);

module.exports = router;
