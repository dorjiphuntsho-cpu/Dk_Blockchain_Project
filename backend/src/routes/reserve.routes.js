const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { ROLE_NAMES } = require('../utils/enums');
const reserveController = require('../controllers/reserve.controller');
const {
  listReservesQuerySchema,
  reserveIdParamSchema,
  rejectReserveSchema,
} = require('../validators/reserve.validation');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(listReservesQuerySchema),
  asyncHandler(reserveController.getReserves),
);

router.get(
  '/:id',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.MAKER, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR),
  validate(reserveIdParamSchema),
  asyncHandler(reserveController.getReserveById),
);

router.post(
  '/:id/approve',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER),
  validate(reserveIdParamSchema),
  asyncHandler(reserveController.approveReserve),
);

router.post(
  '/:id/reject',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER),
  validate(rejectReserveSchema),
  asyncHandler(reserveController.rejectReserve),
);

module.exports = router;
