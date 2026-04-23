const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { requestPayloadInclude } = require('../models/tokenRequest.model');
const solanaService = require('./solana.service');
const { EXECUTION_MODES, TOKEN_REQUEST_TYPES } = require('../utils/enums');

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

async function prepareMintCreationPayload() {
  const configStatus = await solanaService.getConfigStatus();
  const configAddress = configStatus.configAddress;
  const tokenAuthority = solanaService.getTokenAuthorityAddress(configAddress);

  return {
    operation: 'CREATE_MINT',
    signerRole: 'ADMIN',
    requiresBrowserWallet: true,
    expectedAdminWalletAddress: configStatus.configuredSigners.admin,
    rpcUrl: configStatus.rpcUrl,
    commitment: configStatus.commitment,
    programId: configStatus.programId,
    configAddress,
    tokenAuthority,
    metadataProgramId: solanaService.getMetadataProgramId(),
  };
}

function withExecutionContext(tokenRequest, operation) {
  const executionContext = solanaService.getExecutionContext(tokenRequest);

  return {
    ...executionContext,
    operation,
    requestId: tokenRequest.id,
    initiatedBy: tokenRequest.makerUser,
  };
}

async function prepareMintRequestPayload(requestId) {
  const tokenRequest = await getRequestForExecution(requestId);
  if (tokenRequest.requestType !== TOKEN_REQUEST_TYPES.MINT) {
    throw new ApiError(400, 'This preparation endpoint only supports MINT requests');
  }

  return {
    ...withExecutionContext(tokenRequest, 'MINT'),
    destinationWallet: tokenRequest.destinationWallet,
    destinationWalletAddress: tokenRequest.destinationWallet?.walletAddress || null,
    walletInitiationRequired: true,
  };
}

async function prepareTransferRequestPayload(requestId) {
  const tokenRequest = await getRequestForExecution(requestId);
  if (tokenRequest.requestType !== TOKEN_REQUEST_TYPES.TRANSFER) {
    throw new ApiError(400, 'This preparation endpoint only supports TRANSFER requests');
  }

  return {
    ...withExecutionContext(tokenRequest, 'TRANSFER'),
    sourceWallet: tokenRequest.sourceWallet,
    sourceWalletAddress: tokenRequest.sourceWallet?.walletAddress || null,
    destinationWallet: tokenRequest.destinationWallet,
    destinationWalletAddress: tokenRequest.destinationWallet?.walletAddress || null,
    walletInitiationRequired: true,
  };
}

async function prepareBurnRequestPayload(requestId) {
  const tokenRequest = await getRequestForExecution(requestId);
  if (tokenRequest.requestType !== TOKEN_REQUEST_TYPES.BURN) {
    throw new ApiError(400, 'This preparation endpoint only supports BURN requests');
  }

  return {
    ...withExecutionContext(tokenRequest, 'BURN'),
    sourceWallet: tokenRequest.sourceWallet,
    sourceWalletAddress: tokenRequest.sourceWallet?.walletAddress || null,
    walletInitiationRequired: true,
  };
}

async function prepareCheckerApprovalPayload(requestId) {
  const tokenRequest = await getRequestForExecution(requestId);
  const executionContext = solanaService.getExecutionContext(tokenRequest);

  return {
    ...executionContext,
    operation: 'APPROVE',
    requestId: tokenRequest.id,
    signerRole: 'CHECKER',
    requiresBrowserWallet: true,
    onChainRequestAddress: tokenRequest.onChainRequestAddress || null,
  };
}

async function prepareCheckerRejectionPayload(requestId) {
  const tokenRequest = await getRequestForExecution(requestId);
  const executionContext = solanaService.getExecutionContext(tokenRequest);

  return {
    ...executionContext,
    operation: 'REJECT',
    requestId: tokenRequest.id,
    signerRole: 'CHECKER',
    requiresBrowserWallet: true,
    supportsOnChainRejection: true,
    onChainRequestAddress: tokenRequest.onChainRequestAddress || null,
  };
}

async function prepareMintExecutionPayload(requestId) {
  return prepareMintRequestPayload(requestId);
}

async function prepareTransferExecutionPayload(requestId) {
  return prepareTransferRequestPayload(requestId);
}

async function prepareBurnExecutionPayload(requestId) {
  return prepareBurnRequestPayload(requestId);
}

async function prepareExecutionPayload(requestId) {
  const tokenRequest = await getRequestForExecution(requestId);

  if (tokenRequest.requestType === TOKEN_REQUEST_TYPES.MINT) {
    return {
      ...(await prepareMintExecutionPayload(requestId)),
      currentExecutionMode: tokenRequest.executionMode,
    };
  }

  if (tokenRequest.requestType === TOKEN_REQUEST_TYPES.TRANSFER) {
    return {
      ...(await prepareTransferExecutionPayload(requestId)),
      currentExecutionMode: tokenRequest.executionMode,
    };
  }

  return {
    ...(await prepareBurnExecutionPayload(requestId)),
    currentExecutionMode: tokenRequest.executionMode,
  };
}

async function recordInitiationResult(requestId, payload, tx = prisma) {
  return tx.tokenRequest.update({
    where: { id: requestId },
    data: {
      executionMode: EXECUTION_MODES.BROWSER_WALLET,
      makerWalletAddress: payload.makerWalletAddress,
      onChainRequestAddress: payload.onChainRequestAddress,
      initiationTxSignature: payload.initiationTxSignature,
      initiationExplorerUrl: payload.initiationExplorerUrl || null,
      sourceTokenAccountAddress: payload.sourceTokenAccountAddress || null,
      destinationTokenAccountAddress: payload.destinationTokenAccountAddress || null,
      makerInitiatedAt: new Date(),
    },
    include: requestPayloadInclude,
  });
}

async function recordTransactionResult(
  requestId,
  txSignature,
  explorerUrl,
  status,
  executionError,
  tx = prisma,
  metadata = {},
) {
  return tx.tokenRequest.update({
    where: { id: requestId },
    data: {
      status,
      txSignature: txSignature || null,
      explorerUrl: explorerUrl || null,
      executionError: executionError || null,
      onChainRequestAddress: metadata.onChainRequestAddress || undefined,
      sourceTokenAccountAddress: metadata.sourceTokenAccountAddress || undefined,
      destinationTokenAccountAddress: metadata.destinationTokenAccountAddress || undefined,
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
  prepareExecutionPayload,
  prepareMintExecutionPayload,
  prepareTransferExecutionPayload,
  prepareBurnExecutionPayload,
  prepareMintCreationPayload,
  prepareMintRequestPayload,
  prepareTransferRequestPayload,
  prepareBurnRequestPayload,
  prepareCheckerApprovalPayload,
  prepareCheckerRejectionPayload,
  recordInitiationResult,
  recordTransactionResult,
};
