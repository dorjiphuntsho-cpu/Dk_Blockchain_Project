const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { requestPayloadInclude } = require('../models/tokenRequest.model');

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
    integrationReady: false,
    operation: 'MINT',
    requestId: tokenRequest.id,
    tokenMintAddress: tokenRequest.tokenMintAddress,
    amount: tokenRequest.amount.toString(),
    destinationWallet: tokenRequest.destinationWallet,
    initiatedBy: tokenRequest.makerUser,
    // TODO: Replace placeholder payload construction with real Solana transaction assembly.
  };
}

async function prepareTransferExecutionPayload(requestId) {
  const tokenRequest = await getRequestForExecution(requestId);

  return {
    integrationReady: false,
    operation: 'TRANSFER',
    requestId: tokenRequest.id,
    tokenMintAddress: tokenRequest.tokenMintAddress,
    amount: tokenRequest.amount.toString(),
    sourceWallet: tokenRequest.sourceWallet,
    destinationWallet: tokenRequest.destinationWallet,
    initiatedBy: tokenRequest.makerUser,
    // TODO: Replace placeholder payload construction with real Solana transaction assembly.
  };
}

async function prepareBurnExecutionPayload(requestId) {
  const tokenRequest = await getRequestForExecution(requestId);

  return {
    integrationReady: false,
    operation: 'BURN',
    requestId: tokenRequest.id,
    tokenMintAddress: tokenRequest.tokenMintAddress,
    amount: tokenRequest.amount.toString(),
    sourceWallet: tokenRequest.sourceWallet,
    initiatedBy: tokenRequest.makerUser,
    // TODO: Replace placeholder payload construction with real Solana transaction assembly.
  };
}

async function recordTransactionResult(requestId, txSignature, explorerUrl, status, executionError, tx = prisma) {
  // TODO: This database update is a placeholder. When Solana integration is added,
  // this method should become the shared adapter called by the execution worker.
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

module.exports = {
  prepareMintExecutionPayload,
  prepareTransferExecutionPayload,
  prepareBurnExecutionPayload,
  recordTransactionResult,
};
