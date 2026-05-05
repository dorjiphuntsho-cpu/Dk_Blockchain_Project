const express = require('express');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const roleRoutes = require('./role.routes');
const walletRoutes = require('./wallet.routes');
const tokenRequestRoutes = require('./tokenRequest.routes');
const approvalRoutes = require('./approval.routes');
const auditLogRoutes = require('./auditLog.routes');
const dashboardRoutes = require('./dashboard.routes');
const solanaRoutes = require('./solana.routes');
const managedTokenRoutes = require('./managedToken.routes');
const bankRoutes = require('./bank.routes');
const bipsRoutes = require('./bips.routes');
const cbsRoutes = require('./cbs.routes');
const paymentsRoutes = require('./payments.routes');
const reserveRoutes = require('./reserve.routes');
const settlementRoutes = require('./settlement.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/wallets', walletRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/solana', solanaRoutes);
router.use('/managed-tokens', managedTokenRoutes);
router.use('/banks', bankRoutes);
router.use('/bips', bipsRoutes);
router.use('/cbs', cbsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/reserves', reserveRoutes);
router.use('/settlements', settlementRoutes);
router.use('/token-requests', tokenRequestRoutes);
router.use('/token-requests', approvalRoutes); // approval subpaths for token requests
router.use('/audit-logs', auditLogRoutes);

module.exports = router;
