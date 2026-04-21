const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const userController = require('../controllers/user.controller');
const roleController = require('../controllers/role.controller');
const {
  createUserSchema,
  listUsersQuerySchema,
  userIdParamSchema,
  updateUserSchema,
  updateUserStatusSchema,
  assignRolesSchema,
} = require('../validators/user.validation');

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(ROLE_NAMES.ADMIN));

router.post('/', validate(createUserSchema), asyncHandler(userController.createUser));
router.get('/', validate(listUsersQuerySchema), asyncHandler(userController.getUsers));
router.get('/:id', validate(userIdParamSchema), asyncHandler(userController.getUserById));
router.patch('/:id', validate(updateUserSchema), asyncHandler(userController.updateUser));
router.patch('/:id/status', validate(updateUserStatusSchema), asyncHandler(userController.updateUserStatus));
router.post('/:id/roles', validate(assignRolesSchema), asyncHandler(roleController.assignRoles));

module.exports = router;
