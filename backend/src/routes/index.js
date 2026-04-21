const express = require('express');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const roleRoutes = require('./role.routes');
const walletRoutes = require('./wallet.routes');
const tokenRequestRoutes = require('./tokenRequest.routes');
const approvalRoutes = require('./approval.routes');
const auditLogRoutes = require('./auditLog.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/wallets', walletRoutes);
router.use('/token-requests', tokenRequestRoutes);
router.use('/token-requests', approvalRoutes);
router.use('/audit-logs', auditLogRoutes);

module.exports = router;
