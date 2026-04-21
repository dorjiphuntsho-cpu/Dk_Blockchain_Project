const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const {
  APPROVAL_ACTIONS,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  TOKEN_REQUEST_STATUSES,
  VALID_STATUS_TRANSITIONS,
} = require('../utils/enums');
const { approvalInclude } = require('../models/tokenRequest.model');
const auditLogService = require('./auditLog.service');

function assertTransition(currentStatus, nextStatus) {
  const allowedStatuses = VALID_STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowedStatuses.includes(nextStatus)) {
    throw new ApiError(400, `Invalid status transition from ${currentStatus} to ${nextStatus}`);
  }
}

async function getPendingRequest(requestId) {
  const tokenRequest = await prisma.tokenRequest.findUnique({
    where: { id: requestId },
    include: approvalInclude,
  });

  if (!tokenRequest) {
    throw new ApiError(404, 'Token request not found');
  }

  if (tokenRequest.status !== TOKEN_REQUEST_STATUSES.PENDING_APPROVAL) {
    throw new ApiError(400, 'Only PENDING_APPROVAL requests can be approved or rejected');
  }

  return tokenRequest;
}

function assertCheckerSeparation(tokenRequest, checkerUserId) {
  if (tokenRequest.makerUserId === checkerUserId) {
    throw new ApiError(403, 'Maker cannot approve or reject their own request');
  }
}

async function approveTokenRequest(requestId, checkerUserId, payload) {
  const tokenRequest = await getPendingRequest(requestId);
  assertCheckerSeparation(tokenRequest, checkerUserId);
  assertTransition(tokenRequest.status, TOKEN_REQUEST_STATUSES.APPROVED);

  const approvedRequest = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.tokenRequest.update({
      where: { id: requestId },
      data: {
        checkerUserId,
        status: TOKEN_REQUEST_STATUSES.APPROVED,
        approvedAt: new Date(),
        rejectionReason: null,
      },
      include: approvalInclude,
    });

    await tx.requestApproval.create({
      data: {
        tokenRequestId: requestId,
        checkerUserId,
        action: APPROVAL_ACTIONS.APPROVED,
        comment: payload.comment || null,
      },
    });

    await auditLogService.createAuditLog(
      {
        actorUserId: checkerUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: requestId,
        action: AUDIT_ACTIONS.APPROVE,
        metadata: {
          previousStatus: tokenRequest.status,
          newStatus: TOKEN_REQUEST_STATUSES.APPROVED,
          comment: payload.comment || null,
        },
      },
      tx,
    );

    await auditLogService.createAuditLog(
      {
        actorUserId: checkerUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: requestId,
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        metadata: {
          previousStatus: tokenRequest.status,
          newStatus: TOKEN_REQUEST_STATUSES.APPROVED,
        },
      },
      tx,
    );

    return updatedRequest;
  });

  return approvedRequest;
}

async function rejectTokenRequest(requestId, checkerUserId, payload) {
  const tokenRequest = await getPendingRequest(requestId);
  assertCheckerSeparation(tokenRequest, checkerUserId);
  assertTransition(tokenRequest.status, TOKEN_REQUEST_STATUSES.REJECTED);

  const rejectedRequest = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.tokenRequest.update({
      where: { id: requestId },
      data: {
        checkerUserId,
        status: TOKEN_REQUEST_STATUSES.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: payload.rejectionReason,
      },
      include: approvalInclude,
    });

    await tx.requestApproval.create({
      data: {
        tokenRequestId: requestId,
        checkerUserId,
        action: APPROVAL_ACTIONS.REJECTED,
        comment: payload.comment || payload.rejectionReason,
      },
    });

    await auditLogService.createAuditLog(
      {
        actorUserId: checkerUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: requestId,
        action: AUDIT_ACTIONS.REJECT,
        metadata: {
          previousStatus: tokenRequest.status,
          newStatus: TOKEN_REQUEST_STATUSES.REJECTED,
          rejectionReason: payload.rejectionReason,
          comment: payload.comment || null,
        },
      },
      tx,
    );

    await auditLogService.createAuditLog(
      {
        actorUserId: checkerUserId,
        entityType: AUDIT_ENTITY_TYPES.TOKEN_REQUEST,
        entityId: requestId,
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        metadata: {
          previousStatus: tokenRequest.status,
          newStatus: TOKEN_REQUEST_STATUSES.REJECTED,
        },
      },
      tx,
    );

    return updatedRequest;
  });

  return rejectedRequest;
}

module.exports = {
  approveTokenRequest,
  rejectTokenRequest,
};
