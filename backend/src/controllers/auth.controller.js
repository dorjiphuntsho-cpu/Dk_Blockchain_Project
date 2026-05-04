const { successResponse } = require('../utils/apiResponse');
const authService = require('../services/auth.service');

async function login(req, res) {
  const result = await authService.login(req.validated.body);

  return successResponse(res, {
    message: 'Login successful',
    data: result,
  });
}

async function customerLogin(req, res) {
  const result = await authService.customerLogin(req.validated.body);

  return successResponse(res, {
    message: 'Customer login successful',
    data: result,
  });
}

async function me(req, res) {
  const user = await authService.getCurrentUser(req.user.id);

  return successResponse(res, {
    message: 'Current user fetched successfully',
    data: user,
  });
}

async function customerPortalSummary(req, res) {
  const summary = await authService.getCustomerPortalSummary(req.user.id);

  return successResponse(res, {
    message: 'Customer portal summary fetched successfully',
    data: summary,
  });
}

module.exports = {
  customerLogin,
  customerPortalSummary,
  login,
  me,
};
