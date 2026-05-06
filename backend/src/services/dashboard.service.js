const prisma = require('../config/prisma');
const { tokenRequestInclude } = require('../models/tokenRequest.model');
const { ROLE_NAMES, TOKEN_REQUEST_STATUSES } = require('../utils/enums');

function getPrimaryRole(user) {
  if (user.roles.includes(ROLE_NAMES.ADMIN)) return ROLE_NAMES.ADMIN;
  if (user.roles.includes(ROLE_NAMES.MAKER)) return ROLE_NAMES.MAKER;
  if (user.roles.includes(ROLE_NAMES.CHECKER)) return ROLE_NAMES.CHECKER;
  if (user.roles.includes(ROLE_NAMES.EXECUTOR)) return ROLE_NAMES.EXECUTOR;
  return null;
}

function buildVisibilityWhere(user) {
  const primaryRole = getPrimaryRole(user);

  switch (primaryRole) {
    case ROLE_NAMES.ADMIN:
      return {};
    case ROLE_NAMES.MAKER:
      return { makerUserId: user.id };
    case ROLE_NAMES.CHECKER:
      return {
        OR: [
          { status: TOKEN_REQUEST_STATUSES.PENDING_APPROVAL },
          { checkerUserId: user.id },
        ],
      };
    case ROLE_NAMES.EXECUTOR:
      return {
        status: {
          in: [
            TOKEN_REQUEST_STATUSES.APPROVED,
            TOKEN_REQUEST_STATUSES.READY_FOR_EXECUTION,
            TOKEN_REQUEST_STATUSES.EXECUTED,
            TOKEN_REQUEST_STATUSES.FAILED,
          ],
        },
      };
    default:
      return { id: '__no_visible_requests__' };
  }
}

async function getDashboardOverview(user) {
  const visibleWhere = buildVisibilityWhere(user);
  const pendingWhere = {
    ...visibleWhere,
    status: TOKEN_REQUEST_STATUSES.PENDING_APPROVAL,
  };

  const [
    totalRequests,
    pendingApprovals,
    approvedRequests,
    readyForExecution,
    executedRequests,
    failedRequests,
    recentRequests,
    pendingApprovalRequests,
    auditTrail,
  ] = await Promise.all([
    prisma.tokenRequest.count({ where: visibleWhere }),
    prisma.tokenRequest.count({ where: pendingWhere }),
    prisma.tokenRequest.count({
      where: {
        ...visibleWhere,
        status: TOKEN_REQUEST_STATUSES.APPROVED,
      },
    }),
    prisma.tokenRequest.count({
      where: {
        ...visibleWhere,
        status: TOKEN_REQUEST_STATUSES.READY_FOR_EXECUTION,
      },
    }),
    prisma.tokenRequest.count({
      where: {
        ...visibleWhere,
        status: TOKEN_REQUEST_STATUSES.EXECUTED,
      },
    }),
    prisma.tokenRequest.count({
      where: {
        ...visibleWhere,
        status: TOKEN_REQUEST_STATUSES.FAILED,
      },
    }),
    prisma.tokenRequest.findMany({
      where: visibleWhere,
      include: tokenRequestInclude,
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.tokenRequest.findMany({
      where: pendingWhere,
      include: tokenRequestInclude,
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        actorUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    summary: {
      totalRequests,
      pendingApprovals,
      approvedRequests,
      readyForExecution,
      executedRequests,
      failedRequests,
    },
    recentRequests,
    pendingApprovals: pendingApprovalRequests,
    auditTrail,
  };
}

module.exports = {
  getDashboardOverview,
};
