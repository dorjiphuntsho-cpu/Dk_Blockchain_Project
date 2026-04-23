const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { buildPagination, getPagination, getSortOptions } = require('../utils/pagination');
const {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ROLE_NAMES,
  TOKEN_REQUEST_STATUSES,
  TOKEN_REQUEST_TYPES,
  VALID_STATUS_TRANSITIONS,
} = require('../utils/enums');
const { tokenRequestInclude } = require('../models/tokenRequest.model');
const auditLogService = require('./auditLog.service');
const blockchainService = require('./blockchain.service');
const solanaService = require('./solana.service');

function assertTransition(currentStatus, nextStatus) {
  const allowedStatuses = VALID_STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowedStatuses.includes(nextStatus)) {
    throw new ApiError(400, `Invalid status transition from ${currentStatus} to ${nextStatus}`);
  }
}

function hasElevatedExecutionAccess(actorUser) {
  return actorUser.roles.some((role) =>
    [ROLE_NAMES.ADMIN, ROLE_NAMES.CHECKER, ROLE_NAMES.EXECUTOR].includes(role),
  );
}

function hasRole(actorUser, roleName) {
  return actorUser.roles.includes(roleName);
}

function isOnChainPendingStatus(status) {
  return [
    TOKEN_REQUEST_STATUSES.READY_FOR_EXECUTION,
    TOKEN_REQUEST_STATUSES.ON_CHAIN_PENDING,
  ].includes(status);
}

function normalizeOnChainPendingStatus(status) {
  if (status === TOKEN_REQUEST_STATUSES.ON_CHAIN_PENDING) {
    return TOKEN_REQUEST_STATUSES.READY_FOR_EXECUTION;
  }

  return status;
}

function assertExecutionPreparationAccess(actorUser, tokenRequest) {
  if (tokenRequest.makerUserId === actorUser.id) {
    return;
  }

  if (hasElevatedExecutionAccess(actorUser)) {
    return;
  }

  throw new ApiError(403, 'You do not have access to execution preparation for this token request');
}

function assertMakerPreparationAccess(actorUser, tokenRequest) {
  if (hasRole(actorUser, ROLE_NAMES.ADMIN)) {
    return;
  }

  if (hasRole(actorUser, ROLE_NAMES.MAKER) && tokenRequest.makerUserId === actorUser.id) {
    return;
  }

  throw new ApiError(403, 'Only the request maker or an admin can prepare maker wallet payloads');
}

function assertCheckerPreparationAccess(actorUser, tokenRequest) {
  if (hasRole(actorUser, ROLE_NAMES.ADMIN)) {
    return;
  }

  if (!hasRole(actorUser, ROLE_NAMES.CHECKER)) {
    throw new ApiError(403, 'Only checker or admin users can prepare checker wallet payloads');
  }

  if (tokenRequest.checkerUserId && tokenRequest.checkerUserId !== actorUser.id) {
    throw new ApiError(403, 'Only the assigned checker can prepare checker wallet payloads');
  }
}

function assertReadyForExecution(tokenRequest) {
  if (!isOnChainPendingStatus(tokenRequest.status)) {
    throw new ApiError(400, 'Only on-chain pending requests can be prepared for browser signing');
  }
}

function assertDraftForInitiation(tokenRequest) {
  if (tokenRequest.status !== TOKEN_REQUEST_STATUSES.DRAFT) {
    throw new ApiError(400, 'Only DRAFT requests can be prepared for maker wallet signing');
  }
}

async function createPreparationAuditLog({
  actorUserId,
  tokenRequest,
  preparationType,
  payload,
}) {
  await auditLogService.createAuditLog({
    actorUserId,
    entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
    entityId: tokenRequest.id,
    action: AUDIT_ACTIONS.PREPARE_EXECUTION,
    metadata: {
      preparationType,
      requestType: tokenRequest.requestType,
      status: tokenRequest.status,
      operation: payload.operation || null,
      onChainRequestAddress: tokenRequest.onChainRequestAddress || null,
    },
  });
}

async function ensureWalletState(walletId, fieldName, tx = prisma) {
  if (!walletId) {
    return null;
  }

  const wallet = await tx.wallet.findUnique({
    where: { id: walletId },
  });

  if (!wallet) {
    throw new ApiError(404, `${fieldName} wallet not found`);
  }

  if (!wallet.isActive) {
    throw new ApiError(400, `${fieldName} wallet is inactive`);
  }

  return wallet;
}

async function validateTokenRequestPayload(payload, tx = prisma) {
  if (payload.requestType === TOKEN_REQUEST_TYPES.MINT) {
    if (!payload.destinationWalletId) {
      throw new ApiError(400, 'destinationWalletId is required for MINT requests');
    }

    if (payload.sourceWalletId) {
      throw new ApiError(400, 'sourceWalletId must be omitted for MINT requests');
    }

    await ensureWalletState(payload.destinationWalletId, 'Destination', tx);
  }

  if (payload.requestType === TOKEN_REQUEST_TYPES.TRANSFER) {
    if (!payload.sourceWalletId || !payload.destinationWalletId) {
      throw new ApiError(400, 'sourceWalletId and destinationWalletId are required for TRANSFER requests');
    }

    if (payload.sourceWalletId === payload.destinationWalletId) {
      throw new ApiError(400, 'sourceWalletId and destinationWalletId cannot be the same for TRANSFER requests');
    }

    await ensureWalletState(payload.sourceWalletId, 'Source', tx);
    await ensureWalletState(payload.destinationWalletId, 'Destination', tx);
  }

  if (payload.requestType === TOKEN_REQUEST_TYPES.BURN) {
    if (!payload.sourceWalletId) {
      throw new ApiError(400, 'sourceWalletId is required for BURN requests');
    }

    if (payload.destinationWalletId) {
      throw new ApiError(400, 'destinationWalletId must be omitted for BURN requests');
    }

    await ensureWalletState(payload.sourceWalletId, 'Source', tx);
  }
}

async function getTokenRequestOrThrow(id) {
  const tokenRequest = await prisma.tokenRequest.findUnique({
    where: { id },
    include: tokenRequestInclude,
  });

  if (!tokenRequest) {
    throw new ApiError(404, 'Token request not found');
  }

  return tokenRequest;
}

async function reconcileTokenRequestIfNeeded(tokenRequest) {
  if (!tokenRequest) {
    return tokenRequest;
  }

  return reconcileProcessedOnChainRequest(tokenRequest);
}

async function reconcileTokenRequestCollection(items) {
  return Promise.all(items.map((item) => reconcileTokenRequestIfNeeded(item)));
}

async function reconcileProcessedOnChainRequest(tokenRequest) {
  if (
    !tokenRequest.onChainRequestAddress
    || tokenRequest.status !== TOKEN_REQUEST_STATUSES.PENDING_APPROVAL
  ) {
    return tokenRequest;
  }

  const onChainRequest = await solanaService.fetchTokenRequestAccount(tokenRequest.onChainRequestAddress);
  if (!onChainRequest || onChainRequest.status === 'PENDING') {
    return tokenRequest;
  }

  const nextStatus = onChainRequest.status === 'APPROVED'
    ? TOKEN_REQUEST_STATUSES.APPROVED
    : TOKEN_REQUEST_STATUSES.REJECTED;

  let checkerUserId = null;
  if (onChainRequest.checker) {
    const checkerWallet = await prisma.wallet.findUnique({
      where: { walletAddress: onChainRequest.checker },
      select: { userId: true },
    });
    checkerUserId = checkerWallet?.userId || null;
  }

  const updatedRequest = await prisma.tokenRequest.update({
    where: { id: tokenRequest.id },
    data: {
      status: nextStatus,
      checkerUserId: checkerUserId || tokenRequest.checkerUserId || null,
      approvedAt: nextStatus === TOKEN_REQUEST_STATUSES.APPROVED
        ? tokenRequest.approvedAt || new Date()
        : tokenRequest.approvedAt,
      rejectedAt: nextStatus === TOKEN_REQUEST_STATUSES.REJECTED
        ? tokenRequest.rejectedAt || new Date()
        : tokenRequest.rejectedAt,
      rejectionReason: nextStatus === TOKEN_REQUEST_STATUSES.REJECTED
        ? tokenRequest.rejectionReason || 'Request was already processed on chain.'
        : null,
    },
    include: tokenRequestInclude,
  });

  await auditLogService.createAuditLog({
    actorUserId: checkerUserId || null,
    entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
    entityId: tokenRequest.id,
    action: AUDIT_ACTIONS.STATUS_CHANGE,
    metadata: {
      previousStatus: tokenRequest.status,
      newStatus: nextStatus,
      reconciledFromOnChain: true,
      onChainRequestAddress: tokenRequest.onChainRequestAddress,
      onChainChecker: onChainRequest.checker,
    },
  });

  return updatedRequest;
}

async function createTokenRequest(payload, actorUserId) {
  const tokenRequest = await prisma.$transaction(async (tx) => {
    await validateTokenRequestPayload(payload, tx);

    const createdRequest = await tx.tokenRequest.create({
      data: {
        requestType: payload.requestType,
        tokenMintAddress: payload.tokenMintAddress,
        amount: payload.amount,
        sourceWalletId: payload.sourceWalletId || null,
        destinationWalletId: payload.destinationWalletId || null,
        makerUserId: actorUserId,
        remarks: payload.remarks || null,
        status: TOKEN_REQUEST_STATUSES.DRAFT,
      },
      include: tokenRequestInclude,
    });

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: createdRequest.id,
        action: AUDIT_ACTIONS.CREATE,
        metadata: {
          requestType: createdRequest.requestType,
          amount: createdRequest.amount.toString(),
          sourceWalletId: createdRequest.sourceWalletId,
          destinationWalletId: createdRequest.destinationWalletId,
          status: createdRequest.status,
        },
      },
      tx,
    );

    return createdRequest;
  });

  return tokenRequest;
}

async function listTokenRequests(query) {
  const { page, limit, skip } = getPagination(query);
  const orderBy = getSortOptions(
    query,
    ['createdAt', 'updatedAt', 'amount', 'approvedAt', 'executedAt'],
    { createdAt: 'desc' },
  );

  const where = {
    ...(query.status ? { status: normalizeOnChainPendingStatus(query.status) } : {}),
    ...(query.requestType ? { requestType: query.requestType } : {}),
    ...(query.makerUserId ? { makerUserId: query.makerUserId } : {}),
    ...(query.checkerUserId ? { checkerUserId: query.checkerUserId } : {}),
    ...(query.sourceWalletId ? { sourceWalletId: query.sourceWalletId } : {}),
    ...(query.destinationWalletId ? { destinationWalletId: query.destinationWalletId } : {}),
    ...(query.tokenMintAddress
      ? {
          tokenMintAddress: {
            contains: query.tokenMintAddress,
            mode: 'insensitive',
          },
        }
      : {}),
    ...((query.dateFrom || query.dateTo)
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
          },
        }
      : {}),
  };

  const [items, totalItems] = await prisma.$transaction([
    prisma.tokenRequest.findMany({
      where,
      include: tokenRequestInclude,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.tokenRequest.count({ where }),
  ]);

  const reconciledItems = await reconcileTokenRequestCollection(items);

  return {
    items: reconciledItems,
    pagination: buildPagination({ page, limit, totalItems }),
  };
}

async function getTokenRequestById(id) {
  const tokenRequest = await getTokenRequestOrThrow(id);
  return reconcileTokenRequestIfNeeded(tokenRequest);
}

async function updateTokenRequest(id, payload, actorUserId) {
  const existingRequest = await getTokenRequestOrThrow(id);

  if (existingRequest.makerUserId !== actorUserId) {
    throw new ApiError(403, 'You can only update your own token requests');
  }

  if (existingRequest.status !== TOKEN_REQUEST_STATUSES.DRAFT) {
    throw new ApiError(400, 'Only DRAFT requests can be edited');
  }

  const mergedPayload = {
    requestType: payload.requestType || existingRequest.requestType,
    tokenMintAddress: payload.tokenMintAddress || existingRequest.tokenMintAddress,
    amount: payload.amount || existingRequest.amount.toString(),
    sourceWalletId:
      payload.sourceWalletId !== undefined ? payload.sourceWalletId : existingRequest.sourceWalletId,
    destinationWalletId:
      payload.destinationWalletId !== undefined
        ? payload.destinationWalletId
        : existingRequest.destinationWalletId,
    remarks: payload.remarks !== undefined ? payload.remarks : existingRequest.remarks,
  };

  const changedFields = {};
  for (const field of ['requestType', 'tokenMintAddress', 'amount', 'sourceWalletId', 'destinationWalletId', 'remarks']) {
    const previousValue =
      field === 'amount' ? existingRequest.amount.toString() : existingRequest[field];
    const nextValue = mergedPayload[field];

    if (nextValue !== previousValue) {
      changedFields[field] = {
        previous: previousValue,
        current: nextValue,
      };
    }
  }

  const updatedRequest = await prisma.$transaction(async (tx) => {
    await validateTokenRequestPayload(mergedPayload, tx);

    const request = await tx.tokenRequest.update({
      where: { id },
      data: {
        requestType: mergedPayload.requestType,
        tokenMintAddress: mergedPayload.tokenMintAddress,
        amount: mergedPayload.amount,
        sourceWalletId: mergedPayload.sourceWalletId || null,
        destinationWalletId: mergedPayload.destinationWalletId || null,
        remarks: mergedPayload.remarks || null,
      },
      include: tokenRequestInclude,
    });

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: id,
        action: AUDIT_ACTIONS.UPDATE,
        metadata: {
          changedFields,
        },
      },
      tx,
    );

    return request;
  });

  return updatedRequest;
}

async function submitTokenRequest(id, actorUserId) {
  const existingRequest = await getTokenRequestOrThrow(id);

  if (existingRequest.makerUserId !== actorUserId) {
    throw new ApiError(403, 'You can only submit your own token requests');
  }

  if (existingRequest.status !== TOKEN_REQUEST_STATUSES.DRAFT) {
    throw new ApiError(400, 'Only DRAFT requests can be submitted');
  }

  assertTransition(existingRequest.status, TOKEN_REQUEST_STATUSES.PENDING_APPROVAL);

  const tokenRequest = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.tokenRequest.update({
      where: { id },
      data: {
        status: TOKEN_REQUEST_STATUSES.PENDING_APPROVAL,
      },
      include: tokenRequestInclude,
    });

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: id,
        action: AUDIT_ACTIONS.SUBMIT,
        metadata: {
          previousStatus: existingRequest.status,
          newStatus: TOKEN_REQUEST_STATUSES.PENDING_APPROVAL,
        },
      },
      tx,
    );

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: id,
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        metadata: {
          previousStatus: existingRequest.status,
          newStatus: TOKEN_REQUEST_STATUSES.PENDING_APPROVAL,
        },
      },
      tx,
    );

    return updatedRequest;
  });

  return tokenRequest;
}

async function markReadyForExecution(id, actorUserId) {
  const existingRequest = await getTokenRequestOrThrow(id);

  if (existingRequest.status !== TOKEN_REQUEST_STATUSES.APPROVED) {
    throw new ApiError(400, 'Only APPROVED requests can be marked on-chain pending');
  }

  assertTransition(existingRequest.status, TOKEN_REQUEST_STATUSES.READY_FOR_EXECUTION);

  const tokenRequest = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.tokenRequest.update({
      where: { id },
      data: {
        status: TOKEN_REQUEST_STATUSES.READY_FOR_EXECUTION,
      },
      include: tokenRequestInclude,
    });

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: id,
        action: AUDIT_ACTIONS.MARK_READY,
        metadata: {
          previousStatus: existingRequest.status,
          newStatus: TOKEN_REQUEST_STATUSES.READY_FOR_EXECUTION,
        },
      },
      tx,
    );

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: id,
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        metadata: {
          previousStatus: existingRequest.status,
          newStatus: TOKEN_REQUEST_STATUSES.READY_FOR_EXECUTION,
        },
      },
      tx,
    );

    return updatedRequest;
  });

  return tokenRequest;
}

async function prepareExecution(id, actorUser) {
  const existingRequest = await getTokenRequestOrThrow(id);

  assertReadyForExecution(existingRequest);

  assertExecutionPreparationAccess(actorUser, existingRequest);

  const payload = await blockchainService.prepareExecutionPayload(id);
  await createPreparationAuditLog({
    actorUserId: actorUser.id,
    tokenRequest: existingRequest,
    preparationType: 'EXECUTION_GENERIC',
    payload,
  });

  return payload;
}

async function prepareMintRequest(id, actorUser) {
  const existingRequest = await getTokenRequestOrThrow(id);
  assertDraftForInitiation(existingRequest);
  assertMakerPreparationAccess(actorUser, existingRequest);

  if (existingRequest.requestType !== TOKEN_REQUEST_TYPES.MINT) {
    throw new ApiError(400, 'This endpoint only supports MINT requests');
  }

  const payload = await blockchainService.prepareMintRequestPayload(id);
  await createPreparationAuditLog({
    actorUserId: actorUser.id,
    tokenRequest: existingRequest,
    preparationType: 'MAKER_MINT_REQUEST',
    payload,
  });

  return payload;
}

async function prepareTransferRequest(id, actorUser) {
  const existingRequest = await getTokenRequestOrThrow(id);
  assertDraftForInitiation(existingRequest);
  assertMakerPreparationAccess(actorUser, existingRequest);

  if (existingRequest.requestType !== TOKEN_REQUEST_TYPES.TRANSFER) {
    throw new ApiError(400, 'This endpoint only supports TRANSFER requests');
  }

  const payload = await blockchainService.prepareTransferRequestPayload(id);
  await createPreparationAuditLog({
    actorUserId: actorUser.id,
    tokenRequest: existingRequest,
    preparationType: 'MAKER_TRANSFER_REQUEST',
    payload,
  });

  return payload;
}

async function prepareBurnRequest(id, actorUser) {
  const existingRequest = await getTokenRequestOrThrow(id);
  assertDraftForInitiation(existingRequest);
  assertMakerPreparationAccess(actorUser, existingRequest);

  if (existingRequest.requestType !== TOKEN_REQUEST_TYPES.BURN) {
    throw new ApiError(400, 'This endpoint only supports BURN requests');
  }

  const payload = await blockchainService.prepareBurnRequestPayload(id);
  await createPreparationAuditLog({
    actorUserId: actorUser.id,
    tokenRequest: existingRequest,
    preparationType: 'MAKER_BURN_REQUEST',
    payload,
  });

  return payload;
}

async function prepareCheckerApproval(id, actorUser, checkerWalletAddress) {
  let existingRequest = await getTokenRequestOrThrow(id);
  existingRequest = await reconcileProcessedOnChainRequest(existingRequest);
  if (existingRequest.status !== TOKEN_REQUEST_STATUSES.PENDING_APPROVAL) {
    throw new ApiError(400, 'Request is already processed on chain. Reload the page to sync the latest status.');
  }
  assertCheckerPreparationAccess(actorUser, existingRequest);

  if (!existingRequest.onChainRequestAddress) {
    throw new ApiError(
      400,
      'Maker wallet initiation must be recorded before checker approval can be prepared',
    );
  }

  const payload = await blockchainService.prepareCheckerApprovalPayload(id, checkerWalletAddress);
  await createPreparationAuditLog({
    actorUserId: actorUser.id,
    tokenRequest: existingRequest,
    preparationType: 'CHECKER_APPROVAL',
    payload,
  });

  return payload;
}

async function prepareCheckerRejection(id, actorUser, checkerWalletAddress) {
  let existingRequest = await getTokenRequestOrThrow(id);
  existingRequest = await reconcileProcessedOnChainRequest(existingRequest);
  if (existingRequest.status !== TOKEN_REQUEST_STATUSES.PENDING_APPROVAL) {
    throw new ApiError(400, 'Request is already processed on chain. Reload the page to sync the latest status.');
  }
  assertCheckerPreparationAccess(actorUser, existingRequest);

  if (!existingRequest.onChainRequestAddress) {
    throw new ApiError(
      400,
      'Maker wallet initiation must be recorded before checker rejection can be prepared',
    );
  }

  const payload = await blockchainService.prepareCheckerRejectionPayload(id, checkerWalletAddress);
  await createPreparationAuditLog({
    actorUserId: actorUser.id,
    tokenRequest: existingRequest,
    preparationType: 'CHECKER_REJECTION',
    payload,
  });

  return payload;
}

async function recordInitiation(id, payload, actorUserId) {
  const existingRequest = await getTokenRequestOrThrow(id);

  if (existingRequest.makerUserId !== actorUserId) {
    throw new ApiError(403, 'You can only record initiation for your own token requests');
  }

  if (existingRequest.status !== TOKEN_REQUEST_STATUSES.DRAFT) {
    throw new ApiError(400, 'Only DRAFT requests can record wallet initiation');
  }

  // Phase A: All request types now support browser wallet initiation including MINT
  const expectedMakerWalletAddress = existingRequest.sourceWallet?.walletAddress || existingRequest.makerWalletAddress;
  if (expectedMakerWalletAddress && payload.makerWalletAddress !== expectedMakerWalletAddress) {
    throw new ApiError(
      400,
      `makerWalletAddress must match the expected wallet address ${expectedMakerWalletAddress}`,
    );
  }

  const tokenRequest = await prisma.$transaction(async (tx) => {
    const updatedRequest = await blockchainService.recordInitiationResult(id, {
      ...payload,
      nextStatus: TOKEN_REQUEST_STATUSES.PENDING_APPROVAL,
    }, tx);

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: id,
        action: AUDIT_ACTIONS.RECORD_INITIATION,
        metadata: {
          previousExecutionMode: existingRequest.executionMode,
          newExecutionMode: updatedRequest.executionMode,
          makerWalletAddress: updatedRequest.makerWalletAddress,
          onChainRequestAddress: updatedRequest.onChainRequestAddress,
          initiationTxSignature: updatedRequest.initiationTxSignature,
          initiationExplorerUrl: updatedRequest.initiationExplorerUrl,
          newStatus: TOKEN_REQUEST_STATUSES.PENDING_APPROVAL,
        },
      },
      tx,
    );

    return tx.tokenRequest.findUnique({
      where: { id },
      include: tokenRequestInclude,
    });
  });

  return tokenRequest;
}

async function recordExecution(id, payload, actorUserId) {
  const existingRequest = await getTokenRequestOrThrow(id);

  if (!isOnChainPendingStatus(existingRequest.status)) {
    throw new ApiError(400, 'Only on-chain pending requests can record execution results');
  }

  assertTransition(existingRequest.status, payload.status);

  if (payload.status === TOKEN_REQUEST_STATUSES.FAILED && !payload.executionError) {
    throw new ApiError(400, 'executionError is required when status is FAILED');
  }

  const tokenRequest = await prisma.$transaction(async (tx) => {
    await blockchainService.recordTransactionResult(
      id,
      payload.txSignature,
      payload.explorerUrl,
      payload.status,
      payload.status === TOKEN_REQUEST_STATUSES.EXECUTED ? null : payload.executionError,
      tx,
      {
        onChainRequestAddress: existingRequest.onChainRequestAddress,
        sourceTokenAccountAddress: existingRequest.sourceTokenAccountAddress,
        destinationTokenAccountAddress: existingRequest.destinationTokenAccountAddress,
      },
    );

    const updatedRequest = await tx.tokenRequest.findUnique({
      where: { id },
      include: tokenRequestInclude,
    });

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: id,
        action: AUDIT_ACTIONS.RECORD_EXECUTION,
        metadata: {
          previousStatus: existingRequest.status,
          newStatus: payload.status,
          txSignature: payload.txSignature || null,
          explorerUrl: payload.explorerUrl || null,
          executionError: payload.executionError || null,
        },
      },
      tx,
    );

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: id,
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        metadata: {
          previousStatus: existingRequest.status,
          newStatus: payload.status,
        },
      },
      tx,
    );

    return updatedRequest;
  });

  return tokenRequest;
}

async function executeReadyRequest(id, actorUserId) {
  const existingRequest = await getTokenRequestOrThrow(id);

  if (!isOnChainPendingStatus(existingRequest.status)) {
    throw new ApiError(400, 'Only on-chain pending requests can be executed');
  }

  let executionResult;
  try {
    executionResult = await blockchainService.executeReadyRequest(id);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    await prisma.$transaction(async (tx) => {
      await blockchainService.recordTransactionResult(
        id,
        null,
        null,
        TOKEN_REQUEST_STATUSES.FAILED,
        error.message,
        tx,
        {
          onChainRequestAddress: existingRequest.onChainRequestAddress,
          sourceTokenAccountAddress: existingRequest.sourceTokenAccountAddress,
          destinationTokenAccountAddress: existingRequest.destinationTokenAccountAddress,
        },
      );

      await auditLogService.createAuditLog(
        {
          actorUserId,
          entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
          entityId: id,
          action: AUDIT_ACTIONS.RECORD_EXECUTION,
          metadata: {
            previousStatus: existingRequest.status,
            newStatus: TOKEN_REQUEST_STATUSES.FAILED,
            txSignature: null,
            explorerUrl: null,
            executionError: error.message,
          },
        },
        tx,
      );

      await auditLogService.createAuditLog(
        {
          actorUserId,
          entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
          entityId: id,
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          metadata: {
            previousStatus: existingRequest.status,
            newStatus: TOKEN_REQUEST_STATUSES.FAILED,
          },
        },
        tx,
      );
    });

    throw error;
  }

  const tokenRequest = await prisma.$transaction(async (tx) => {
    await blockchainService.recordTransactionResult(
      id,
      executionResult.txSignature,
      executionResult.explorerUrl,
      TOKEN_REQUEST_STATUSES.EXECUTED,
      null,
      tx,
      {
        onChainRequestAddress: executionResult.onChainRequestAddress,
        sourceTokenAccountAddress: executionResult.sourceTokenAccount,
        destinationTokenAccountAddress: executionResult.destinationTokenAccount,
      },
    );

    const updatedRequest = await tx.tokenRequest.findUnique({
      where: { id },
      include: tokenRequestInclude,
    });

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: id,
        action: AUDIT_ACTIONS.RECORD_EXECUTION,
        metadata: {
          previousStatus: existingRequest.status,
          newStatus: TOKEN_REQUEST_STATUSES.EXECUTED,
          txSignature: executionResult.txSignature,
          explorerUrl: executionResult.explorerUrl,
          onChainRequestAddress: executionResult.onChainRequestAddress,
          createSignature: executionResult.createSignature,
          approveSignature: executionResult.approveSignature,
        },
      },
      tx,
    );

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: id,
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        metadata: {
          previousStatus: existingRequest.status,
          newStatus: TOKEN_REQUEST_STATUSES.EXECUTED,
        },
      },
      tx,
    );

    return updatedRequest;
  });

  return {
    tokenRequest,
    execution: executionResult,
  };
}

module.exports = {
  createTokenRequest,
  listTokenRequests,
  getTokenRequestById,
  updateTokenRequest,
  submitTokenRequest,
  markReadyForExecution,
  prepareExecution,
  prepareMintRequest,
  prepareTransferRequest,
  prepareBurnRequest,
  prepareCheckerApproval,
  prepareCheckerRejection,
  recordInitiation,
  recordExecution,
  executeReadyRequest,
};
