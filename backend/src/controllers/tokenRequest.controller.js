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

async function cancelTokenRequest(req, res) {
  const tokenRequest = await tokenRequestService.cancelTokenRequest(req.params.id, req.user.id);

  return successResponse(res, {
    message: 'Token request cancelled successfully',
    data: tokenRequest,
  });
}

async function markReadyForExecution(req, res) {
  const tokenRequest = await tokenRequestService.markReadyForExecution(req.params.id, req.user.id);
  const executionPayload = await tokenRequestService.prepareExecution(req.params.id, req.user);

  return successResponse(res, {
    message: 'Token request moved to the on-chain pending queue successfully',
    data: {
      tokenRequest,
      executionPayload,
    },
  });
}

async function prepareExecution(req, res) {
  const executionPayload = await tokenRequestService.prepareExecution(req.params.id, req.user);

  return successResponse(res, {
    message: 'Execution payload prepared successfully',
    data: executionPayload,
  });
}

async function prepareMintRequest(req, res) {
  const executionPayload = await tokenRequestService.prepareMintRequest(req.params.id, req.user);

  return successResponse(res, {
    message: 'Mint request payload prepared successfully',
    data: executionPayload,
  });
}

async function prepareTransferRequest(req, res) {
  const executionPayload = await tokenRequestService.prepareTransferRequest(req.params.id, req.user);

  return successResponse(res, {
    message: 'Transfer request payload prepared successfully',
    data: executionPayload,
  });
}

async function prepareBurnRequest(req, res) {
  const executionPayload = await tokenRequestService.prepareBurnRequest(req.params.id, req.user);

  return successResponse(res, {
    message: 'Burn request payload prepared successfully',
    data: executionPayload,
  });
}

async function prepareMakerCancellation(req, res) {
  const executionPayload = await tokenRequestService.prepareMakerCancellation(
    req.params.id,
    req.user,
    req.validated.query?.makerWalletAddress,
  );

  return successResponse(res, {
    message: 'Maker cancellation payload prepared successfully',
    data: executionPayload,
  });
}

async function prepareCheckerApproval(req, res) {
  const executionPayload = await tokenRequestService.prepareCheckerApproval(
    req.params.id,
    req.user,
    req.validated.query?.checkerWalletAddress,
  );

  return successResponse(res, {
    message: 'Checker approval payload prepared successfully',
    data: executionPayload,
  });
}

async function prepareCheckerRejection(req, res) {
  const executionPayload = await tokenRequestService.prepareCheckerRejection(
    req.params.id,
    req.user,
    req.validated.query?.checkerWalletAddress,
  );

  return successResponse(res, {
    message: 'Checker rejection payload prepared successfully',
    data: executionPayload,
  });
}

async function recordInitiation(req, res) {
  const tokenRequest = await tokenRequestService.recordInitiation(req.params.id, req.validated.body, req.user.id);

  return successResponse(res, {
    message: 'Wallet initiation recorded successfully',
    data: tokenRequest,
  });
}

async function recordCancellation(req, res) {
  const tokenRequest = await tokenRequestService.recordCancellation(req.params.id, req.validated.body, req.user.id);

  return successResponse(res, {
    message: 'Wallet cancellation recorded successfully',
    data: tokenRequest,
  });
}

async function recordExecution(req, res) {
  const tokenRequest = await tokenRequestService.recordExecution(req.params.id, req.validated.body, req.user.id);

  return successResponse(res, {
    message: 'Execution result recorded successfully',
    data: tokenRequest,
  });
}

async function executeReadyRequest(req, res) {
  const result = await tokenRequestService.executeReadyRequest(req.params.id, req.user.id);

  return successResponse(res, {
    message: 'Token request executed successfully',
    data: result,
  });
}

module.exports = {
  createTokenRequest,
  getTokenRequests,
  getTokenRequestById,
  updateTokenRequest,
  submitTokenRequest,
  cancelTokenRequest,
  markReadyForExecution,
  prepareExecution,
  prepareMintRequest,
  prepareTransferRequest,
  prepareBurnRequest,
  prepareMakerCancellation,
  prepareCheckerApproval,
  prepareCheckerRejection,
  recordInitiation,
  recordCancellation,
  recordExecution,
  executeReadyRequest,
};
