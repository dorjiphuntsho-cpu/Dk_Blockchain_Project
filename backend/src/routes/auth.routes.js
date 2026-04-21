const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validateMiddleware');
const authMiddleware = require('../middlewares/authMiddleware');
const authController = require('../controllers/auth.controller');
const { loginSchema } = require('../validators/auth.validation');

const router = express.Router();

router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.get('/me', authMiddleware, asyncHandler(authController.me));

module.exports = router;
