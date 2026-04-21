const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { buildPagination, getPagination, getSortOptions } = require('../utils/pagination');
const {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  TOKEN_REQUEST_STATUSES,
  TOKEN_REQUEST_TYPES,
  VALID_STATUS_TRANSITIONS,
} = require('../utils/enums');
const { tokenRequestInclude } = require('../models/tokenRequest.model');
const auditLogService = require('./auditLog.service');
const blockchainService = require('./blockchain.service');

function assertTransition(currentStatus, nextStatus) {
  const allowedStatuses = VALID_STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowedStatuses.includes(nextStatus)) {
    throw new ApiError(400, `Invalid status transition from ${currentStatus} to ${nextStatus}`);
  }
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
    ...(query.status ? { status: query.status } : {}),
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

  return {
    items,
    pagination: buildPagination({ page, limit, totalItems }),
  };
}

async function getTokenRequestById(id) {
  return getTokenRequestOrThrow(id);
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
    throw new ApiError(400, 'Only APPROVED requests can be marked ready for execution');
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

async function recordExecution(id, payload, actorUserId) {
  const existingRequest = await getTokenRequestOrThrow(id);

  if (existingRequest.status !== TOKEN_REQUEST_STATUSES.READY_FOR_EXECUTION) {
    throw new ApiError(400, 'Only READY_FOR_EXECUTION requests can record execution results');
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

async function prepareExecutionPayload(id) {
  const tokenRequest = await getTokenRequestOrThrow(id);

  if (tokenRequest.requestType === TOKEN_REQUEST_TYPES.MINT) {
    return blockchainService.prepareMintExecutionPayload(id);
  }

  if (tokenRequest.requestType === TOKEN_REQUEST_TYPES.TRANSFER) {
    return blockchainService.prepareTransferExecutionPayload(id);
  }

  return blockchainService.prepareBurnExecutionPayload(id);
}

module.exports = {
  createTokenRequest,
  listTokenRequests,
  getTokenRequestById,
  updateTokenRequest,
  submitTokenRequest,
  markReadyForExecution,
  recordExecution,
  prepareExecutionPayload,
};
