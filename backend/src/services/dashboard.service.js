const prisma = require('../config/prisma');
const { tokenRequestInclude } = require('../models/tokenRequest.model');
const { ROLE_NAMES, TOKEN_REQUEST_STATUSES } = require('../utils/enums');
const cbsService = require('./cbs.service');
const reserveService = require('./reserve.service');
const solanaService = require('./solana.service');

function formatTokenSupply(rawAmount, decimals) {
  const normalizedRawAmount = String(rawAmount ?? '0');
  const normalizedDecimals = Number.isInteger(decimals) && decimals >= 0 ? decimals : 0;

  if (normalizedDecimals === 0) {
    return normalizedRawAmount;
  }

  const padded = normalizedRawAmount.padStart(normalizedDecimals + 1, '0');
  const whole = padded.slice(0, -normalizedDecimals) || '0';
  const fraction = padded.slice(-normalizedDecimals).replace(/0+$/, '');

  return fraction ? `${whole}.${fraction}` : whole;
}

function normalizeTokenLabel(value) {
  return String(value || '').trim().toUpperCase();
}

function selectDashboardManagedToken(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return null;
  }

  const exactBtnSymbolMatch = tokens.find((token) => normalizeTokenLabel(token.symbol) === 'BTN');
  if (exactBtnSymbolMatch) {
    return exactBtnSymbolMatch;
  }

  const btnNameMatch = tokens.find((token) => normalizeTokenLabel(token.name).includes('BTN'));
  if (btnNameMatch) {
    return btnNameMatch;
  }

  return tokens[0];
}

function subtractRawAmounts(totalRawAmount, allocatedRawAmount) {
  const total = BigInt(String(totalRawAmount ?? '0'));
  const allocated = BigInt(String(allocatedRawAmount ?? '0'));
  return total > allocated ? String(total - allocated) : '0';
}

async function buildDashboardTokenSummary() {
  const managedTokens = await prisma.managedToken.findMany({
    orderBy: [{ createdAt: 'desc' }],
  });
  const managedToken = selectDashboardManagedToken(managedTokens);

  if (!managedToken) {
    return {
      id: null,
      name: 'BTN Token',
      symbol: 'BTN',
      mintAddress: null,
      decimals: 0,
      totalSupplyRaw: null,
      totalSupplyDisplay: null,
      distributionInventory: null,
      inCirculationRaw: null,
      inCirculationDisplay: null,
      warning: 'No managed BTN token is registered yet.',
    };
  }

  const issuerBank = await prisma.bank.findFirst({
    where: {
      isIssuer: true,
      isActive: true,
    },
    include: {
      accounts: {
        where: {
          isActive: true,
        },
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'asc' },
        ],
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  });
  const hydratedToken = await solanaService.hydrateManagedToken(managedToken);
  const decimals = hydratedToken.onChain?.decimals ?? hydratedToken.decimals ?? 0;
  const rawSupply = hydratedToken.onChain?.supply ?? '0';
  let distributionInventory = null;

  if (issuerBank?.id && hydratedToken.mintAddress) {
    try {
      const distributionTokenAccount = await solanaService.resolveBankDistributionTokenAccount(
        issuerBank.id,
        hydratedToken.mintAddress,
      );
      const distributionBalance = await solanaService.getTokenAccountBalance(
        distributionTokenAccount.tokenAccountAddress,
      );

      distributionInventory = {
        purpose: distributionTokenAccount.purpose,
        tokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
        walletAddress: distributionTokenAccount.treasuryWalletAddress,
        rawAmount: distributionBalance.rawAmount,
        displayAmount: formatTokenSupply(distributionBalance.rawAmount, decimals),
      };
    } catch (error) {
      distributionInventory = {
        purpose: 'DISTRIBUTION',
        tokenAccountAddress: null,
        walletAddress: null,
        rawAmount: null,
        displayAmount: null,
        warning: error.message,
      };
    }
  }

  const inCirculationRaw = distributionInventory?.rawAmount != null
    ? subtractRawAmounts(rawSupply, distributionInventory.rawAmount)
    : rawSupply;

  return {
    id: hydratedToken.id,
    name: hydratedToken.name || 'BTN Token',
    symbol: hydratedToken.symbol || 'BTN',
    mintAddress: hydratedToken.mintAddress,
    decimals,
    totalSupplyRaw: rawSupply,
    totalSupplyDisplay: formatTokenSupply(rawSupply, decimals),
    distributionInventory,
    inCirculationRaw,
    inCirculationDisplay: formatTokenSupply(inCirculationRaw, decimals),
    warning: hydratedToken.warning || distributionInventory?.warning || null,
  };
}

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
  const includeReserveFlowSummary = user.roles.includes(ROLE_NAMES.ADMIN);

  const [
    summaryCounts,
    recentRequests,
    pendingApprovals,
    auditTrail,
    settlementCounts,
    recentSettlements,
    pendingSettlementReconciliation,
    issuerReserveBalance,
    tokenSummary,
    reserveTransactions,
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
    buildDashboardTokenSummary().catch((error) => ({
      id: null,
      name: 'BTN Token',
      symbol: 'BTN',
      mintAddress: null,
      decimals: 0,
      totalSupplyRaw: null,
      totalSupplyDisplay: null,
      distributionInventory: null,
      inCirculationRaw: null,
      inCirculationDisplay: null,
      warning: error.message,
    })),
    includeReserveFlowSummary
      ? reserveService.getReserveTransactions().catch(() => [])
      : Promise.resolve([]),
  ]);

  const countByStatus = Object.fromEntries(
    summaryCounts.map((item) => [item.status, item._count._all]),
  );
  const onChainPendingRequests =
    (countByStatus[TOKEN_REQUEST_STATUSES.READY_FOR_EXECUTION] || 0) +
    (countByStatus[TOKEN_REQUEST_STATUSES.ON_CHAIN_PENDING] || 0);
  const reserveFlowSummary = includeReserveFlowSummary
    ? reserveTransactions.reduce((summary, item) => {
        const amount = Number(item.amount || 0);

        if (item.type === 'CREDIT') {
          summary.incomingAmount += amount;
          summary.incomingCount += 1;
        }

        if (item.type === 'DEBIT') {
          summary.outgoingAmount += amount;
          summary.outgoingCount += 1;
        }

        return summary;
      }, {
        incomingAmount: 0,
        incomingCount: 0,
        outgoingAmount: 0,
        outgoingCount: 0,
        currency: reserveTransactions[0]?.currency || 'BTN',
      })
    : null;
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
    tokenSummary,
    issuerReserveBalance,
    reserveFlowSummary,
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
