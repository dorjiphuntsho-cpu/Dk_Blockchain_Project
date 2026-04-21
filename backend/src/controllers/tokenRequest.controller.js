const { successResponse, listResponse } = require('../utils/apiResponse');
const tokenRequestService = require('../services/tokenRequest.service');

async function createTokenRequest(req, res) {
  const tokenRequest = await tokenRequestService.createTokenRequest(req.validated.body, req.user.id);

  return successResponse(res, {
    statusCode: 201,
    message: 'Token request created successfully',
    data: tokenRequest,
  });
}

async function getTokenRequests(req, res) {
  const result = await tokenRequestService.listTokenRequests(req.validated.query);

  return listResponse(res, {
    message: 'Token requests fetched successfully',
    items: result.items,
    pagination: result.pagination,
  });
}

async function getTokenRequestById(req, res) {
  const tokenRequest = await tokenRequestService.getTokenRequestById(req.params.id);

  return successResponse(res, {
    message: 'Token request fetched successfully',
    data: tokenRequest,
  });
}

async function updateTokenRequest(req, res) {
  const tokenRequest = await tokenRequestService.updateTokenRequest(req.params.id, req.validated.body, req.user.id);

  return successResponse(res, {
    message: 'Token request updated successfully',
    data: tokenRequest,
  });
}

async function submitTokenRequest(req, res) {
  const tokenRequest = await tokenRequestService.submitTokenRequest(req.params.id, req.user.id);

  return successResponse(res, {
    message: 'Token request submitted successfully',
    data: tokenRequest,
  });
}

async function markReadyForExecution(req, res) {
  const tokenRequest = await tokenRequestService.markReadyForExecution(req.params.id, req.user.id);
  const executionPayload = await tokenRequestService.prepareExecutionPayload(req.params.id);

  return successResponse(res, {
    message: 'Token request marked ready for execution successfully',
    data: {
      tokenRequest,
      executionPayload,
    },
  });
}

async function recordExecution(req, res) {
  const tokenRequest = await tokenRequestService.recordExecution(req.params.id, req.validated.body, req.user.id);

  return successResponse(res, {
    message: 'Execution result recorded successfully',
    data: tokenRequest,
  });
}

module.exports = {
  createTokenRequest,
  getTokenRequests,
  getTokenRequestById,
  updateTokenRequest,
  submitTokenRequest,
  markReadyForExecution,
  recordExecution,
};
