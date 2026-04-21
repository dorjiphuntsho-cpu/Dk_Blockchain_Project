const { successResponse } = require('../utils/apiResponse');
const authService = require('../services/auth.service');

async function login(req, res) {
  const result = await authService.login(req.validated.body);

  return successResponse(res, {
    message: 'Login successful',
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

module.exports = {
  login,
  me,
};
