const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { requestPayloadInclude } = require('../models/tokenRequest.model');
const solanaService = require('./solana.service');
const { EXECUTION_MODES, TOKEN_REQUEST_STATUSES, TOKEN_REQUEST_TYPES } = require('../utils/enums');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');

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

function serializeTransactionInstruction(instruction) {
  return {
    programId: instruction.programId.toBase58(),
    keys: instruction.keys.map((meta) => ({
      pubkey: meta.pubkey.toBase58(),
      isSigner: meta.isSigner,
      isWritable: meta.isWritable,
    })),
    data: Buffer.from(instruction.data).toString('base64'),
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

async function prepareCheckerApprovalPayload(requestId, checkerWalletAddress = null) {
  const tokenRequest = await getRequestForExecution(requestId);
  const executionContext = solanaService.getExecutionContext(tokenRequest);
  const configStatus = await solanaService.getConfigStatus();
  const checkerSignerAddress = checkerWalletAddress || configStatus.configuredSigners.checker || null;
  if (!checkerSignerAddress) {
    throw new ApiError(
      400,
      'checkerWalletAddress is required when no default checker signer address is configured on the backend',
    );
  }
  const instructionProgram = solanaService.getProgram(solanaService.getAdminKeypair());
  const sourceTokenAccount =
    tokenRequest.sourceTokenAccountAddress || executionContext.sourceTokenAccount || null;
  const destinationTokenAccount =
    tokenRequest.destinationTokenAccountAddress || executionContext.destinationTokenAccount || null;

  const approvalInstruction = await instructionProgram.methods
    .approveRequest()
    .accounts({
      request: tokenRequest.onChainRequestAddress,
      config: executionContext.configAddress,
      mint: tokenRequest.tokenMintAddress,
      sourceTokenAccount: tokenRequest.requestType === TOKEN_REQUEST_TYPES.BURN ? sourceTokenAccount : tokenRequest.requestType === TOKEN_REQUEST_TYPES.TRANSFER ? sourceTokenAccount : null,
      destinationTokenAccount: tokenRequest.requestType === TOKEN_REQUEST_TYPES.BURN ? null : destinationTokenAccount,
      tokenAuthority: executionContext.tokenAuthority,
      checker: checkerSignerAddress,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return {
    ...executionContext,
    operation: 'APPROVE',
    requestId: tokenRequest.id,
    signerRole: 'CHECKER',
    requiresBrowserWallet: true,
    expectedCheckerWalletAddress: checkerSignerAddress,
    onChainRequestAddress: tokenRequest.onChainRequestAddress || null,
    onChainCheckers: configStatus.onChain?.checkers || [],
    approvalInstruction: serializeTransactionInstruction(approvalInstruction),
  };
}

async function prepareCheckerRejectionPayload(requestId, checkerWalletAddress = null) {
  const tokenRequest = await getRequestForExecution(requestId);
  const executionContext = solanaService.getExecutionContext(tokenRequest);
  const configStatus = await solanaService.getConfigStatus();
  const checkerSignerAddress = checkerWalletAddress || configStatus.configuredSigners.checker || null;
  if (!checkerSignerAddress) {
    throw new ApiError(
      400,
      'checkerWalletAddress is required when no default checker signer address is configured on the backend',
    );
  }
  const instructionProgram = solanaService.getProgram(solanaService.getAdminKeypair());
  const rejectionInstruction = await instructionProgram.methods
    .rejectRequest()
    .accounts({
      request: tokenRequest.onChainRequestAddress,
      config: executionContext.configAddress,
      checker: checkerSignerAddress,
    })
    .instruction();

  return {
    ...executionContext,
    operation: 'REJECT',
    requestId: tokenRequest.id,
    signerRole: 'CHECKER',
    requiresBrowserWallet: true,
    supportsOnChainRejection: true,
    expectedCheckerWalletAddress: checkerSignerAddress,
    onChainRequestAddress: tokenRequest.onChainRequestAddress || null,
    onChainCheckers: configStatus.onChain?.checkers || [],
    rejectionInstruction: serializeTransactionInstruction(rejectionInstruction),
  };
}

async function prepareMakerCancellationPayload(requestId, makerWalletAddress = null) {
  const tokenRequest = await getRequestForExecution(requestId);
  const executionContext = solanaService.getExecutionContext(tokenRequest);
  const instructionProgram = solanaService.getProgram(solanaService.getAdminKeypair());
  const makerSignerAddress = makerWalletAddress
    || tokenRequest.makerWalletAddress
    || tokenRequest.sourceWallet?.walletAddress
    || null;

  const cancelInstruction = await instructionProgram.methods
    .cancelRequest()
    .accounts({
      request: tokenRequest.onChainRequestAddress,
      config: executionContext.configAddress,
      maker: makerSignerAddress,
    })
    .instruction();

  return {
    ...executionContext,
    operation: 'CANCEL',
    requestId: tokenRequest.id,
    signerRole: 'MAKER',
    requiresBrowserWallet: true,
    expectedMakerWalletAddress: makerSignerAddress,
    onChainRequestAddress: tokenRequest.onChainRequestAddress || null,
    cancelInstruction: serializeTransactionInstruction(cancelInstruction),
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
  const configStatus = await solanaService.getConfigStatus();

  if (tokenRequest.requestType === TOKEN_REQUEST_TYPES.MINT) {
    return {
      ...(await prepareMintExecutionPayload(requestId)),
      currentExecutionMode: tokenRequest.executionMode,
      onChainCheckers: configStatus.onChain?.checkers || [],
    };
  }

  if (tokenRequest.requestType === TOKEN_REQUEST_TYPES.TRANSFER) {
    return {
      ...(await prepareTransferExecutionPayload(requestId)),
      currentExecutionMode: tokenRequest.executionMode,
      onChainCheckers: configStatus.onChain?.checkers || [],
    };
  }

  return {
    ...(await prepareBurnExecutionPayload(requestId)),
    currentExecutionMode: tokenRequest.executionMode,
    onChainCheckers: configStatus.onChain?.checkers || [],
  };
}

async function recordInitiationResult(requestId, payload, tx = prisma) {
  return tx.tokenRequest.update({
    where: { id: requestId },
    data: {
      status: payload.nextStatus || undefined,
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

async function recordCancellationResult(
  requestId,
  makerWalletAddress,
  txSignature,
  explorerUrl,
  tx = prisma,
) {
  return tx.tokenRequest.update({
    where: { id: requestId },
    data: {
      checkerUserId: null,
      rejectionReason: null,
      approvedAt: null,
      rejectedAt: null,
      status: TOKEN_REQUEST_STATUSES.CANCELLED,
      makerWalletAddress,
      txSignature: txSignature || null,
      explorerUrl: explorerUrl || null,
      executionError: null,
    },
    include: requestPayloadInclude,
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
  prepareMakerCancellationPayload,
  recordInitiationResult,
  recordCancellationResult,
  recordTransactionResult,
};
