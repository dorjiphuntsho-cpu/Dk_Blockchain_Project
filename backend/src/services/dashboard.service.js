const prisma = require('../config/prisma');
const { tokenRequestInclude } = require('../models/tokenRequest.model');
const { ROLE_NAMES, TOKEN_REQUEST_STATUSES } = require('../utils/enums');
const cbsService = require('./cbs.service');

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
          TOKEN_REQUEST_STATUSES.ON_CHAIN_PENDING,
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
  const includeSettlementSummary = user.roles.includes(ROLE_NAMES.ADMIN) || user.roles.includes(ROLE_NAMES.EXECUTOR);

  const [
    summaryCounts,
    recentRequests,
    pendingApprovals,
    auditTrail,
    settlementCounts,
    recentSettlements,
    pendingSettlementReconciliation,
    issuerReserveBalance,
  ] = await Promise.all([
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
    includeSettlementSummary
      ? prisma.settlementRequest.groupBy({
          by: ['requestType', 'status', 'settlementMode'],
          _count: {
            _all: true,
          },
        })
      : Promise.resolve([]),
    includeSettlementSummary
      ? prisma.settlementRequest.findMany({
          include: {
            sourceBank: true,
            destinationBank: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        })
      : Promise.resolve([]),
    includeSettlementSummary
      ? prisma.settlementRequest.findMany({
          where: {
            status: {
              in: ['BIPS_PENDING', 'MANUAL_REVIEW'],
            },
          },
          include: {
            sourceBank: true,
            destinationBank: true,
          },
          orderBy: [
            { executedAt: 'asc' },
            { updatedAt: 'asc' },
          ],
          take: 5,
        })
      : Promise.resolve([]),
    cbsService.getIssuerReserveBalance().catch((error) => ({
      warning: error.message,
    })),
  ]);

  const countByStatus = Object.fromEntries(
    summaryCounts.map((item) => [item.status, item._count._all]),
  );
  const onChainPendingRequests =
    (countByStatus[TOKEN_REQUEST_STATUSES.READY_FOR_EXECUTION] || 0) +
    (countByStatus[TOKEN_REQUEST_STATUSES.ON_CHAIN_PENDING] || 0);
  const settlementSummary = includeSettlementSummary
    ? settlementCounts.reduce((summary, item) => {
        const count = item._count._all;

        if (item.requestType === 'RESERVE_MINT' || item.requestType === 'REPLENISHMENT_MINT') {
          summary.reserveMintCount += count;
        }

        if (item.requestType === 'INTERBANK_TRANSFER' && item.settlementMode === 'ON_CHAIN_BTN') {
          summary.btnTransferCount += count;
        }

        if (item.settlementMode === 'BIPS_FIAT') {
          summary.fiatFallbackCount += count;
        }

        if (item.status === 'BIPS_PENDING') {
          summary.pendingReconciliationCount += count;
        }

        if (item.status === 'MANUAL_REVIEW') {
          summary.manualReviewCount += count;
        }

        if (item.status === 'FAILED') {
          summary.failedSettlementCount += count;
        }

        summary.totalSettlements += count;
        return summary;
      }, {
        totalSettlements: 0,
        reserveMintCount: 0,
        btnTransferCount: 0,
        fiatFallbackCount: 0,
        pendingReconciliationCount: 0,
        manualReviewCount: 0,
        failedSettlementCount: 0,
      })
    : null;

  return {
    summary: {
      totalRequests: summaryCounts.reduce((total, item) => total + item._count._all, 0),
      pendingApprovals: countByStatus[TOKEN_REQUEST_STATUSES.PENDING_APPROVAL] || 0,
      approvedRequests: countByStatus[TOKEN_REQUEST_STATUSES.APPROVED] || 0,
      readyForExecution: onChainPendingRequests,
      onChainPending: onChainPendingRequests,
      executedRequests: countByStatus[TOKEN_REQUEST_STATUSES.EXECUTED] || 0,
      failedRequests: countByStatus[TOKEN_REQUEST_STATUSES.FAILED] || 0,
    },
    issuerReserveBalance,
    settlementSummary,
    recentRequests,
    recentSettlements,
    pendingApprovals,
    pendingSettlementReconciliation,
    auditTrail,
  };
}

module.exports = {
  getDashboardOverview,
};
