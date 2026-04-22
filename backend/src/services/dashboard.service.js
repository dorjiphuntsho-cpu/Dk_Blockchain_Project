const prisma = require('../config/prisma');
const { tokenRequestInclude } = require('../models/tokenRequest.model');
const { ROLE_NAMES, TOKEN_REQUEST_STATUSES } = require('../utils/enums');

function getVisibleRequestWhere(user) {
  if (user.roles.includes(ROLE_NAMES.ADMIN)) {
    return {};
  }

  if (user.roles.includes(ROLE_NAMES.MAKER)) {
    return {
      makerUserId: user.id,
    };
  }

  if (user.roles.includes(ROLE_NAMES.CHECKER)) {
    return {
      OR: [
        { status: TOKEN_REQUEST_STATUSES.PENDING_APPROVAL },
        { checkerUserId: user.id },
      ],
    };
  }

  if (user.roles.includes(ROLE_NAMES.EXECUTOR)) {
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
  }

  return {
    id: '__no_visible_requests__',
  };
}

async function getDashboardOverview(user) {
  const visibleWhere = getVisibleRequestWhere(user);

  const [summaryCounts, recentRequests, pendingApprovals, auditTrail] = await Promise.all([
    prisma.tokenRequest.groupBy({
      by: ['status'],
      where: visibleWhere,
      _count: {
        _all: true,
      },
    }),
    prisma.tokenRequest.findMany({
      where: visibleWhere,
      include: tokenRequestInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    }),
    prisma.tokenRequest.findMany({
      where: {
        ...visibleWhere,
        status: TOKEN_REQUEST_STATUSES.PENDING_APPROVAL,
      },
      include: tokenRequestInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    }),
    user.roles.includes(ROLE_NAMES.ADMIN)
      ? prisma.auditLog.findMany({
          orderBy: {
            createdAt: 'desc',
          },
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
        })
      : Promise.resolve([]),
  ]);

  const countByStatus = Object.fromEntries(
    summaryCounts.map((item) => [item.status, item._count._all]),
  );

  return {
    summary: {
      totalRequests: summaryCounts.reduce((total, item) => total + item._count._all, 0),
      pendingApprovals: countByStatus[TOKEN_REQUEST_STATUSES.PENDING_APPROVAL] || 0,
      approvedRequests: countByStatus[TOKEN_REQUEST_STATUSES.APPROVED] || 0,
      readyForExecution: countByStatus[TOKEN_REQUEST_STATUSES.READY_FOR_EXECUTION] || 0,
      executedRequests: countByStatus[TOKEN_REQUEST_STATUSES.EXECUTED] || 0,
      failedRequests: countByStatus[TOKEN_REQUEST_STATUSES.FAILED] || 0,
    },
    recentRequests,
    pendingApprovals,
    auditTrail,
  };
}

module.exports = {
  getDashboardOverview,
};
