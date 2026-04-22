const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const managedTokenController = require('../controllers/managedToken.controller');
const {
  listManagedTokensQuerySchema,
  managedTokenIdParamSchema,
} = require('../validators/managedToken.validation');

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(ROLE_NAMES.ADMIN));

router.get('/', validate(listManagedTokensQuerySchema), asyncHandler(managedTokenController.getManagedTokens));
router.get('/:id', validate(managedTokenIdParamSchema), asyncHandler(managedTokenController.getManagedTokenById));

module.exports = router;
