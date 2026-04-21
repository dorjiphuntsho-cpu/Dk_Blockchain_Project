const { successResponse } = require('../utils/apiResponse');
const approvalService = require('../services/approval.service');

async function approveTokenRequest(req, res) {
  const tokenRequest = await approvalService.approveTokenRequest(req.params.id, req.user.id, req.validated.body);

  return successResponse(res, {
    message: 'Token request approved successfully',
    data: tokenRequest,
  });
}

async function rejectTokenRequest(req, res) {
  const tokenRequest = await approvalService.rejectTokenRequest(req.params.id, req.user.id, req.validated.body);

  return successResponse(res, {
    message: 'Token request rejected successfully',
    data: tokenRequest,
  });
}

module.exports = {
  approveTokenRequest,
  rejectTokenRequest,
};
