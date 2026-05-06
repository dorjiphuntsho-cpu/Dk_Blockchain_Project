const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

router.use(authMiddleware);
router.get(
  '/',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  asyncHandler(dashboardController.getDashboardOverview),
);

module.exports = router;
