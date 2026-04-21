const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const roleController = require('../controllers/role.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', authorize(ROLE_NAMES.ADMIN), asyncHandler(roleController.getRoles));

module.exports = router;
