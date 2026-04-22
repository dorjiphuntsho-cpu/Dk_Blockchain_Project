const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { requestPayloadInclude } = require('../models/tokenRequest.model');
const solanaService = require('./solana.service');

async function getRequestForExecution(requestId) {
  const tokenRequest = await prisma.tokenRequest.findUnique({
    where: { id: requestId },
    include: requestPayloadInclude,
  });

  if (!tokenRequest) {
    throw new ApiError(404, 'Token request not found');
  }

  return tokenRequest;
}

async function prepareMintExecutionPayload(requestId) {
  const tokenRequest = await getRequestForExecution(requestId);

  return {
    ...solanaService.getExecutionContext(tokenRequest),
    operation: 'MINT',
    requestId: tokenRequest.id,
    destinationWallet: tokenRequest.destinationWallet,
    initiatedBy: tokenRequest.makerUser,
  };
}

async function prepareTransferExecutionPayload(requestId) {
  const tokenRequest = await getRequestForExecution(requestId);

  return {
    ...solanaService.getExecutionContext(tokenRequest),
    operation: 'TRANSFER',
    requestId: tokenRequest.id,
    sourceWallet: tokenRequest.sourceWallet,
    destinationWallet: tokenRequest.destinationWallet,
    initiatedBy: tokenRequest.makerUser,
    requiresDelegation: true,
  };
}

async function prepareBurnExecutionPayload(requestId) {
  const tokenRequest = await getRequestForExecution(requestId);

  return {
    ...solanaService.getExecutionContext(tokenRequest),
    operation: 'BURN',
    requestId: tokenRequest.id,
    sourceWallet: tokenRequest.sourceWallet,
    initiatedBy: tokenRequest.makerUser,
    requiresDelegation: true,
  };
}

async function recordTransactionResult(requestId, txSignature, explorerUrl, status, executionError, tx = prisma) {
  return tx.tokenRequest.update({
    where: { id: requestId },
    data: {
      status,
      txSignature: txSignature || null,
      explorerUrl: explorerUrl || null,
      executionError: executionError || null,
      executedAt: new Date(),
    },
  });
}

async function executeReadyRequest(requestId) {
  const tokenRequest = await getRequestForExecution(requestId);
  return solanaService.executeOnChainRequest(tokenRequest);
}

module.exports = {
  executeReadyRequest,
  prepareMintExecutionPayload,
  prepareTransferExecutionPayload,
  prepareBurnExecutionPayload,
  recordTransactionResult,
};
