const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { buildPagination, getPagination, getSortOptions } = require('../utils/pagination');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../utils/enums');
const { settlementInclude } = require('../models/settlement.model');
const auditLogService = require('./auditLog.service');
const solanaService = require('./solana.service');
const bipsService = require('./bips.service');
const cbsService = require('./cbs.service');
const {
  resolveSettlementMode,
  assessBipsReconciliationResult,
  resolveReconciledSettlementStatus,
  buildReconciliationErrorMessage,
} = require('./settlementPolicy.service');

const SETTLEMENT_REQUEST_TYPES = {
  RESERVE_MINT: 'RESERVE_MINT',
  REPLENISHMENT_MINT: 'REPLENISHMENT_MINT',
  INTERBANK_TRANSFER: 'INTERBANK_TRANSFER',
  REDEMPTION: 'REDEMPTION',
};

const SETTLEMENT_MODES = {
  ON_CHAIN_BTN: 'ON_CHAIN_BTN',
  BIPS_FIAT: 'BIPS_FIAT',
};

const SETTLEMENT_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  INQUIRY_PENDING: 'INQUIRY_PENDING',
  INQUIRY_FAILED: 'INQUIRY_FAILED',
  READY_FOR_EXECUTION: 'READY_FOR_EXECUTION',
  BIPS_PENDING: 'BIPS_PENDING',
  SETTLED: 'SETTLED',
  FAILED: 'FAILED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  CANCELLED: 'CANCELLED',
};

const RESERVE_STATUSES = {
  APPROVED: 'APPROVED',
  LOCKED: 'LOCKED',
  CONSUMED: 'CONSUMED',
};

const PAYMENT_GATEWAY_REFERENCE_TYPE = 'PAYMENT_GATEWAY';
const RESERVE_MINT_RATIO = 0.8;

async function createSettlementAuditLog({ actorUserId, entityId, action, metadata }, tx = prisma) {
  await auditLogService.createAuditLog(
    {
      actorUserId,
      entityType: AUDIT_ENTITY_TYPES.SETTLEMENT_REQUEST,
      entityId,
      action,
      metadata,
    },
    tx,
  );
}

async function createReserveAuditLog({ actorUserId, entityId, action, metadata }, tx = prisma) {
  await auditLogService.createAuditLog(
    {
      actorUserId,
      entityType: AUDIT_ENTITY_TYPES.RESERVE_LEDGER,
      entityId,
      action,
      metadata,
    },
    tx,
  );
}

async function getBankOrThrow(id, tx = prisma) {
  const bank = await tx.bank.findUnique({
    where: { id },
    include: {
      accounts: true,
      tokenAccounts: true,
    },
  });

  if (!bank) {
    throw new ApiError(404, 'Bank not found');
  }

  return bank;
}

async function getReserveLedgerOrThrow(id, tx = prisma) {
  const reserveLedger = await tx.reserveLedger.findUnique({
    where: { id },
  });

  if (!reserveLedger) {
    throw new ApiError(404, 'Reserve ledger not found');
  }

  return reserveLedger;
}

async function getApprovedReserveLedgerForBank(bankId, tx = prisma) {
  return tx.reserveLedger.findFirst({
    where: {
      bankId,
      referenceType: PAYMENT_GATEWAY_REFERENCE_TYPE,
      status: RESERVE_STATUSES.APPROVED,
      availableAmount: {
        gt: 0,
      },
    },
    orderBy: [
      { createdAt: 'asc' },
    ],
  });
}

async function getSettlementOrThrow(id, tx = prisma) {
  const settlement = await tx.settlementRequest.findUnique({
    where: { id },
    include: settlementInclude,
  });

  if (!settlement) {
    throw new ApiError(404, 'Settlement request not found');
  }

  return hydrateSettlement(settlement, tx);
}

function isMintSettlement(settlement) {
  return [
    SETTLEMENT_REQUEST_TYPES.RESERVE_MINT,
    SETTLEMENT_REQUEST_TYPES.REPLENISHMENT_MINT,
  ].includes(settlement.requestType);
}

function isOnChainTransferSettlement(settlement) {
  return settlement.requestType === SETTLEMENT_REQUEST_TYPES.INTERBANK_TRANSFER
    && settlement.settlementMode === SETTLEMENT_MODES.ON_CHAIN_BTN;
}

function isBipsSettlement(settlement) {
  return settlement.requestType === SETTLEMENT_REQUEST_TYPES.REDEMPTION
    || (
      settlement.requestType === SETTLEMENT_REQUEST_TYPES.INTERBANK_TRANSFER
      && settlement.settlementMode === SETTLEMENT_MODES.BIPS_FIAT
    );
}

async function getTreasuryTokenAccountOrThrow(settlement) {
  const tokenAccount = await solanaService.resolveBankTreasuryTokenAccount(
    settlement.sourceBankId,
    settlement.tokenMintAddress,
  );

  if (!tokenAccount.treasuryWalletAddress || !tokenAccount.tokenAccountAddress) {
    throw new ApiError(400, 'Bank treasury owner wallet and treasury token account must be configured before mint initiation');
  }

  return tokenAccount;
}

async function getTransferSettlementTokenAccountsOrThrow(settlement) {
  const sourceTokenAccount = await solanaService.resolveBankTreasuryTokenAccount(
    settlement.sourceBankId,
    settlement.tokenMintAddress,
  );
  const destinationTokenAccount = await solanaService.resolveBankTreasuryTokenAccount(
    settlement.destinationBankId,
    settlement.tokenMintAddress,
  );

  if (!sourceTokenAccount.treasuryWalletAddress || !sourceTokenAccount.tokenAccountAddress) {
    throw new ApiError(400, 'Source bank treasury owner wallet and treasury token account must be configured');
  }

  if (!destinationTokenAccount.treasuryWalletAddress || !destinationTokenAccount.tokenAccountAddress) {
    throw new ApiError(400, 'Destination bank treasury owner wallet and treasury token account must be configured');
  }

  return {
    sourceTokenAccount,
    destinationTokenAccount,
  };
}

async function getBurnSettlementTokenAccountOrThrow(settlement) {
  const sourceTokenAccount = await solanaService.resolveBankTreasuryTokenAccount(
    settlement.sourceBankId,
    settlement.tokenMintAddress,
  );

  if (!sourceTokenAccount.treasuryWalletAddress || !sourceTokenAccount.tokenAccountAddress) {
    throw new ApiError(400, 'Source bank treasury owner wallet and treasury token account must be configured');
  }

  return sourceTokenAccount;
}

function buildMintSettlementRequestShape(settlement, treasuryTokenAccount) {
  return {
    requestType: 'MINT',
    tokenMintAddress: settlement.tokenMintAddress,
    amount: settlement.amount,
    makerWalletAddress: settlement.makerWalletAddress || null,
    destinationWallet: {
      walletAddress: treasuryTokenAccount.treasuryWalletAddress,
    },
    destinationTokenAccountAddress:
      settlement.destinationTokenAccountAddress || treasuryTokenAccount.tokenAccountAddress,
    onChainRequestAddress: settlement.onChainRequestAddress || null,
    initiationTxSignature: settlement.initiationTxSignature || null,
    initiationExplorerUrl: settlement.initiationExplorerUrl || null,
    makerInitiatedAt: settlement.makerInitiatedAt || null,
  };
}

function buildTransferSettlementRequestShape(settlement, sourceTokenAccount, destinationTokenAccount) {
  return {
    requestType: 'TRANSFER',
    tokenMintAddress: settlement.tokenMintAddress,
    amount: settlement.amount,
    makerWalletAddress: settlement.makerWalletAddress || null,
    sourceWallet: {
      walletAddress: sourceTokenAccount.treasuryWalletAddress,
    },
    destinationWallet: {
      walletAddress: destinationTokenAccount.treasuryWalletAddress,
    },
    sourceTokenAccountAddress:
      settlement.sourceTokenAccountAddress || sourceTokenAccount.tokenAccountAddress,
    destinationTokenAccountAddress:
      settlement.destinationTokenAccountAddress || destinationTokenAccount.tokenAccountAddress,
    onChainRequestAddress: settlement.onChainRequestAddress || null,
    initiationTxSignature: settlement.initiationTxSignature || null,
    initiationExplorerUrl: settlement.initiationExplorerUrl || null,
    makerInitiatedAt: settlement.makerInitiatedAt || null,
  };
}

function buildBurnSettlementRequestShape(settlement, sourceTokenAccount) {
  return {
    requestType: 'BURN',
    tokenMintAddress: settlement.tokenMintAddress,
    amount: settlement.amount,
    makerWalletAddress: settlement.makerWalletAddress || null,
    sourceWallet: {
      walletAddress: sourceTokenAccount.treasuryWalletAddress,
    },
    sourceTokenAccountAddress:
      settlement.sourceTokenAccountAddress || sourceTokenAccount.tokenAccountAddress,
    onChainRequestAddress: settlement.onChainRequestAddress || null,
    initiationTxSignature: settlement.initiationTxSignature || null,
    initiationExplorerUrl: settlement.initiationExplorerUrl || null,
    makerInitiatedAt: settlement.makerInitiatedAt || null,
  };
}

async function hydrateSettlement(settlement, tx = prisma) {
  if (!settlement) {
    return settlement;
  }

  const reserveLedger = settlement.reserveLedgerId
    ? await tx.reserveLedger.findUnique({
        where: { id: settlement.reserveLedgerId },
      })
    : null;

  return {
    ...settlement,
    reserveLedger,
  };
}

function numberValue(value) {
  return Number(value);
}

function requireIssuerBank(bank) {
  if (!bank.isIssuer) {
    throw new ApiError(400, 'Only the issuer bank can create mint-based settlement requests');
  }
}

function requirePaymentBackedReserve(reserveLedger) {
  if (reserveLedger.referenceType !== PAYMENT_GATEWAY_REFERENCE_TYPE) {
    throw new ApiError(400, 'Reserve-backed minting currently supports only payment-backed DK reserves');
  }
}

function ensureReserveAvailable(reserveLedger, requestedAmount) {
  if (![RESERVE_STATUSES.APPROVED, RESERVE_STATUSES.LOCKED].includes(reserveLedger.status)) {
    throw new ApiError(400, 'Reserve ledger must be approved before it can support settlement');
  }

  if (numberValue(reserveLedger.availableAmount) < numberValue(requestedAmount)) {
    throw new ApiError(400, 'Reserve-backed capacity is insufficient for the requested amount');
  }
}

function roundReserveMintAmount(value) {
  return Math.round(Number(value || 0));
}

function calculateRequiredReserveMintAmount(reserveLedger) {
  return roundReserveMintAmount(numberValue(reserveLedger.availableAmount) * RESERVE_MINT_RATIO);
}

function ensureReserveMintAmountMatchesPolicy(reserveLedger, requestedAmount) {
  const expectedAmount = calculateRequiredReserveMintAmount(reserveLedger);
  const normalizedRequestedAmount = roundReserveMintAmount(requestedAmount);

  if (normalizedRequestedAmount !== expectedAmount) {
    throw new ApiError(
      400,
      `Reserve mint amount must equal 80% of the available reserve balance, rounded to a whole token (${expectedAmount}).`,
    );
  }
}

function ensureReserveMintAmountMatchesFiatBalance(availableReserveBalance, requestedAmount) {
  const expectedAmount = roundReserveMintAmount(Number(availableReserveBalance || 0) * RESERVE_MINT_RATIO);
  const normalizedRequestedAmount = roundReserveMintAmount(requestedAmount);

  if (normalizedRequestedAmount !== expectedAmount) {
    throw new ApiError(
      400,
      `Reserve mint amount must equal 80% of the available reserve balance, rounded to a whole token (${expectedAmount}).`,
    );
  }
}

function getReserveStatusAfterLock(reserveLedger, amount) {
  const nextLockedAmount = Number(reserveLedger.lockedAmount || 0) + Number(amount);

  if (nextLockedAmount > 0) {
    return RESERVE_STATUSES.LOCKED;
  }

  return RESERVE_STATUSES.APPROVED;
}

function getReserveStatusAfterConsume(reserveLedger, amount) {
  const nextLockedAmount = Number(reserveLedger.lockedAmount || 0) - Number(amount);
  const nextAvailableAmount = Number(reserveLedger.availableAmount || 0);

  if (nextLockedAmount > 0) {
    return RESERVE_STATUSES.LOCKED;
  }

  if (nextLockedAmount <= 0 && nextAvailableAmount <= 0) {
    return RESERVE_STATUSES.CONSUMED;
  }

  return RESERVE_STATUSES.APPROVED;
}

function getReserveStatusAfterRelease(reserveLedger, amount) {
  const nextLockedAmount = Number(reserveLedger.lockedAmount || 0) - Number(amount);

  if (nextLockedAmount > 0) {
    return RESERVE_STATUSES.LOCKED;
  }

  return RESERVE_STATUSES.APPROVED;
}

async function createMintSettlement({
  requestType,
  payload,
  actorUserId,
}) {
  const issuerBank = await getBankOrThrow(payload.sourceBankId);
  requireIssuerBank(issuerBank);
  const reserveLedger = payload.reserveLedgerId
    ? await getReserveLedgerOrThrow(payload.reserveLedgerId)
    : await getApprovedReserveLedgerForBank(issuerBank.id);
  const reserveBalance = await cbsService.getIssuerReserveBalance();

  if (reserveBalance.bank.id !== issuerBank.id) {
    throw new ApiError(400, 'Issuer reserve balance does not belong to the selected issuer bank');
  }

  const availableReserveBalance = Number(reserveBalance?.inquiry?.availableBalance || 0);
  if (availableReserveBalance <= 0) {
    throw new ApiError(400, 'DK Bank reserve fiat balance is unavailable or zero');
  }

  ensureReserveMintAmountMatchesFiatBalance(availableReserveBalance, payload.amount);

  if (reserveLedger) {
    if (reserveLedger.bankId !== issuerBank.id) {
      throw new ApiError(400, 'Reserve ledger does not belong to the selected issuer bank');
    }

    requirePaymentBackedReserve(reserveLedger);
    ensureReserveAvailable(reserveLedger, payload.amount);
    ensureReserveMintAmountMatchesPolicy(reserveLedger, payload.amount);
  }

  return prisma.$transaction(async (tx) => {
    const settlement = await tx.settlementRequest.create({
      data: {
        requestType,
        settlementMode: SETTLEMENT_MODES.ON_CHAIN_BTN,
        status: SETTLEMENT_STATUSES.DRAFT,
        sourceBankId: issuerBank.id,
        reserveLedgerId: reserveLedger?.id || null,
        tokenMintAddress: payload.tokenMintAddress,
        amount: payload.amount,
        transferPurpose: payload.transferPurpose || null,
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: settlement.id,
      action: AUDIT_ACTIONS.CREATE,
      metadata: {
        requestType,
        settlementMode: settlement.settlementMode,
        sourceBankId: issuerBank.id,
        reserveLedgerId: reserveLedger?.id || null,
        reserveFiatAccountNumber: reserveBalance.reserveAccount.accountNumber,
        reserveFiatAvailableBalance: reserveBalance.inquiry.availableBalance,
        amount: payload.amount,
        tokenMintAddress: payload.tokenMintAddress,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: settlement.id,
      action: AUDIT_ACTIONS.ROUTE_SETTLEMENT,
      metadata: {
        selectedMode: SETTLEMENT_MODES.ON_CHAIN_BTN,
        reason: 'Issuer-backed mint requests always settle on chain',
      },
    }, tx);

    return hydrateSettlement(settlement, tx);
  });
}

async function createReserveMintRequest(payload, actorUserId) {
  return createMintSettlement({
    requestType: SETTLEMENT_REQUEST_TYPES.RESERVE_MINT,
    payload,
    actorUserId,
  });
}

async function createReplenishmentMintRequest(payload, actorUserId) {
  return createMintSettlement({
    requestType: SETTLEMENT_REQUEST_TYPES.REPLENISHMENT_MINT,
    payload,
    actorUserId,
  });
}

async function createInterbankTransferRequest(payload, actorUserId) {
  const sourceBank = await getBankOrThrow(payload.sourceBankId);
  const destinationBank = await getBankOrThrow(payload.destinationBankId);

  if (sourceBank.id === destinationBank.id) {
    throw new ApiError(400, 'Source and destination bank cannot be the same');
  }

  const settlementMode = resolveSettlementMode(destinationBank, payload.tokenMintAddress);

  return prisma.$transaction(async (tx) => {
    const settlement = await tx.settlementRequest.create({
      data: {
        requestType: SETTLEMENT_REQUEST_TYPES.INTERBANK_TRANSFER,
        settlementMode,
        status: settlementMode === SETTLEMENT_MODES.ON_CHAIN_BTN
          ? SETTLEMENT_STATUSES.DRAFT
          : SETTLEMENT_STATUSES.DRAFT,
        sourceBankId: sourceBank.id,
        destinationBankId: destinationBank.id,
        tokenMintAddress: payload.tokenMintAddress,
        amount: payload.amount,
        requestId: payload.requestId || null,
        beneficiaryAccountName: payload.beneficiaryAccountName || null,
        beneficiaryAccountNumber: payload.beneficiaryAccountNumber || null,
        beneficiaryBankCode: payload.beneficiaryBankCode || destinationBank.code,
        sourceAccountName: payload.sourceAccountName || null,
        sourceAccountNumber: payload.sourceAccountNumber || null,
        transferPurpose: payload.transferPurpose,
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: settlement.id,
      action: AUDIT_ACTIONS.CREATE,
      metadata: {
        requestType: settlement.requestType,
        sourceBankId: sourceBank.id,
        destinationBankId: destinationBank.id,
        amount: payload.amount,
        tokenMintAddress: payload.tokenMintAddress,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: settlement.id,
      action: AUDIT_ACTIONS.ROUTE_SETTLEMENT,
      metadata: {
        selectedMode: settlementMode,
        destinationBankSupportsBtn: destinationBank.supportsBtn,
      },
    }, tx);

    return hydrateSettlement(settlement, tx);
  });
}

async function createRedemptionRequest(payload, actorUserId) {
  const sourceBank = await getBankOrThrow(payload.sourceBankId);
  const destinationBank = payload.destinationBankId ? await getBankOrThrow(payload.destinationBankId) : null;

  return prisma.$transaction(async (tx) => {
    const settlement = await tx.settlementRequest.create({
      data: {
        requestType: SETTLEMENT_REQUEST_TYPES.REDEMPTION,
        settlementMode: SETTLEMENT_MODES.BIPS_FIAT,
        status: SETTLEMENT_STATUSES.DRAFT,
        sourceBankId: sourceBank.id,
        destinationBankId: destinationBank?.id || null,
        tokenMintAddress: payload.tokenMintAddress,
        amount: payload.amount,
        requestId: payload.requestId,
        beneficiaryAccountName: payload.beneficiaryAccountName,
        beneficiaryAccountNumber: payload.beneficiaryAccountNumber,
        beneficiaryBankCode: payload.beneficiaryBankCode,
        sourceAccountName: payload.sourceAccountName,
        sourceAccountNumber: payload.sourceAccountNumber,
        transferPurpose: payload.transferPurpose,
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: settlement.id,
      action: AUDIT_ACTIONS.CREATE,
      metadata: {
        requestType: settlement.requestType,
        settlementMode: settlement.settlementMode,
        sourceBankId: sourceBank.id,
        destinationBankId: destinationBank?.id || null,
        amount: payload.amount,
        tokenMintAddress: payload.tokenMintAddress,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: settlement.id,
      action: AUDIT_ACTIONS.ROUTE_SETTLEMENT,
      metadata: {
        selectedMode: SETTLEMENT_MODES.BIPS_FIAT,
        reason: 'Redemption requests always settle through fiat fallback',
      },
    }, tx);

    return hydrateSettlement(settlement, tx);
  });
}

async function listSettlements(query) {
  const { page, limit, skip } = getPagination(query);
  const orderBy = getSortOptions(query, ['createdAt', 'updatedAt', 'amount', 'approvedAt', 'settledAt'], { createdAt: 'desc' });
  const where = {
    ...(query.requestType ? { requestType: query.requestType } : {}),
    ...(query.settlementMode ? { settlementMode: query.settlementMode } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.sourceBankId ? { sourceBankId: query.sourceBankId } : {}),
    ...(query.destinationBankId ? { destinationBankId: query.destinationBankId } : {}),
    ...(query.reserveLedgerId ? { reserveLedgerId: query.reserveLedgerId } : {}),
    ...(query.requestId ? { requestId: { contains: query.requestId, mode: 'insensitive' } } : {}),
    ...(query.tokenMintAddress
      ? {
          tokenMintAddress: {
            contains: query.tokenMintAddress,
            mode: 'insensitive',
          },
        }
      : {}),
  };

  const [items, totalItems] = await prisma.$transaction([
    prisma.settlementRequest.findMany({
      where,
      include: settlementInclude,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.settlementRequest.count({ where }),
  ]);

  const hydratedItems = await Promise.all(items.map((item) => hydrateSettlement(item)));

  return {
    items: hydratedItems,
    pagination: buildPagination({ page, limit, totalItems }),
  };
}

async function getSettlementById(id) {
  return getSettlementOrThrow(id);
}

async function routeSettlement(id, actorUserId) {
  const settlement = await getSettlementOrThrow(id);

  if (![SETTLEMENT_REQUEST_TYPES.INTERBANK_TRANSFER, SETTLEMENT_REQUEST_TYPES.REDEMPTION].includes(settlement.requestType)) {
    throw new ApiError(400, 'Only interbank transfer or redemption requests can be rerouted');
  }

  const destinationBank = settlement.destinationBankId ? await getBankOrThrow(settlement.destinationBankId) : null;
  const nextMode = settlement.requestType === SETTLEMENT_REQUEST_TYPES.REDEMPTION
    ? SETTLEMENT_MODES.BIPS_FIAT
    : resolveSettlementMode(destinationBank, settlement.tokenMintAddress);

  const previousMode = settlement.settlementMode || null;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        settlementMode: nextMode,
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.ROUTE_SETTLEMENT,
      metadata: {
        previousMode,
        nextMode,
      },
    }, tx);

    return updatedSettlement;
  });

  return hydrateSettlement(updated);
}

async function approveSettlement(id, actorUserId, payload) {
  const settlement = await getSettlementOrThrow(id);

  if (isMintSettlement(settlement) || isOnChainTransferSettlement(settlement)) {
    throw new ApiError(
      400,
      'Wallet-routed on-chain settlements use maker wallet initiation and checker wallet approval. Use the settlement wallet preparation endpoints instead.',
    );
  }

  if (settlement.status !== SETTLEMENT_STATUSES.PENDING_APPROVAL) {
    throw new ApiError(400, 'Only pending approval settlement requests can be approved');
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (settlement.reserveLedgerId) {
      const reserveLedger = await tx.reserveLedger.findUnique({
        where: { id: settlement.reserveLedgerId },
      });

      if (!reserveLedger) {
        throw new ApiError(404, 'Reserve ledger not found');
      }

      ensureReserveAvailable(reserveLedger, settlement.amount);

      await tx.reserveLedger.update({
        where: { id: reserveLedger.id },
        data: {
          availableAmount: {
            decrement: settlement.amount,
          },
          lockedAmount: {
            increment: settlement.amount,
          },
          status: RESERVE_STATUSES.LOCKED,
        },
      });

      await createReserveAuditLog({
        actorUserId,
        entityId: reserveLedger.id,
        action: AUDIT_ACTIONS.RESERVE_APPROVE,
        metadata: {
          settlementRequestId: settlement.id,
          lockedAmount: settlement.amount,
          comment: payload.comment || null,
        },
      }, tx);
    }

    const updatedSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        status: SETTLEMENT_STATUSES.APPROVED,
        approvedAt: new Date(),
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.APPROVE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.APPROVED,
        comment: payload.comment || null,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.APPROVED,
      },
    }, tx);

    return updatedSettlement;
  });

  return hydrateSettlement(updated);
}

async function rejectSettlement(id, actorUserId, payload) {
  const settlement = await getSettlementOrThrow(id);

  if (settlement.status !== SETTLEMENT_STATUSES.PENDING_APPROVAL) {
    throw new ApiError(400, 'Only pending approval settlement requests can be rejected');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        status: SETTLEMENT_STATUSES.CANCELLED,
        executionError: payload.rejectionReason,
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.REJECT,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.CANCELLED,
        rejectionReason: payload.rejectionReason,
        comment: payload.comment || null,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.CANCELLED,
      },
    }, tx);

    return updatedSettlement;
  });

  return hydrateSettlement(updated);
}

async function markSettlementReadyForExecution(id, actorUserId) {
  const settlement = await getSettlementOrThrow(id);

  if (isMintSettlement(settlement) || isOnChainTransferSettlement(settlement)) {
    throw new ApiError(
      400,
      'Wallet-routed on-chain settlements use the browser wallet flow and are not marked ready for backend execution.',
    );
  }

  if (settlement.status !== SETTLEMENT_STATUSES.APPROVED) {
    throw new ApiError(400, 'Only approved settlement requests can be marked ready for execution');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        status: SETTLEMENT_STATUSES.READY_FOR_EXECUTION,
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.MARK_READY,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.READY_FOR_EXECUTION,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.READY_FOR_EXECUTION,
      },
    }, tx);

    return updatedSettlement;
  });

  return hydrateSettlement(updated);
}

async function executeSettlement(id, actorUserId) {
  const settlement = await getSettlementOrThrow(id);

  if (isMintSettlement(settlement) || isOnChainTransferSettlement(settlement)) {
    throw new ApiError(
      400,
      'Wallet-routed on-chain settlements must use maker wallet initiation plus checker wallet approval. Backend-managed execution is disabled.',
    );
  }

  if (settlement.status !== SETTLEMENT_STATUSES.READY_FOR_EXECUTION) {
    throw new ApiError(400, 'Only ready-for-execution settlement requests can be executed');
  }

  if (![SETTLEMENT_REQUEST_TYPES.RESERVE_MINT, SETTLEMENT_REQUEST_TYPES.REPLENISHMENT_MINT].includes(settlement.requestType)) {
    throw new ApiError(400, 'Phase 5 only supports reserve-backed mint execution');
  }

  let executionResult;
  try {
    executionResult = await solanaService.mintToBankTreasury({
      bankId: settlement.sourceBankId,
      mintAddress: settlement.tokenMintAddress,
      amount: settlement.amount,
    });
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      const updatedSettlement = await tx.settlementRequest.update({
        where: { id },
        data: {
          status: SETTLEMENT_STATUSES.FAILED,
          executionError: error.message,
        },
        include: settlementInclude,
      });

      if (settlement.reserveLedgerId) {
        await tx.reserveLedger.update({
          where: { id: settlement.reserveLedgerId },
          data: {
            availableAmount: {
              increment: settlement.amount,
            },
            lockedAmount: {
              decrement: settlement.amount,
            },
            status: RESERVE_STATUSES.APPROVED,
          },
        });

        await createReserveAuditLog({
          actorUserId,
          entityId: settlement.reserveLedgerId,
          action: AUDIT_ACTIONS.UPDATE,
          metadata: {
            settlementRequestId: settlement.id,
            releasedAmount: settlement.amount,
            reason: 'Mint execution failed and locked reserve capacity was released',
          },
        }, tx);
      }

      await createSettlementAuditLog({
        actorUserId,
        entityId: id,
        action: AUDIT_ACTIONS.RECORD_EXECUTION,
        metadata: {
          previousStatus: settlement.status,
          newStatus: SETTLEMENT_STATUSES.FAILED,
          executionError: error.message,
        },
      }, tx);

      await createSettlementAuditLog({
        actorUserId,
        entityId: id,
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        metadata: {
          previousStatus: settlement.status,
          newStatus: SETTLEMENT_STATUSES.FAILED,
        },
      }, tx);

    });

    throw error instanceof ApiError ? error : new ApiError(500, error.message);
  }

  const executed = await prisma.$transaction(async (tx) => {
    const updatedSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        status: SETTLEMENT_STATUSES.SETTLED,
        txSignature: executionResult.txSignature,
        explorerUrl: executionResult.explorerUrl,
        referenceNumber: executionResult.onChainRequestAddress,
        settledAt: new Date(),
        executedAt: new Date(),
        executionError: null,
      },
      include: settlementInclude,
    });

    if (settlement.reserveLedgerId) {
      const reserveLedger = await tx.reserveLedger.findUnique({
        where: { id: settlement.reserveLedgerId },
      });

      const nextLockedAmount = Number(reserveLedger.lockedAmount) - Number(settlement.amount);
      const nextConsumedAmount = Number(reserveLedger.consumedAmount) + Number(settlement.amount);
      const nextAvailableAmount = Number(reserveLedger.availableAmount);
      let nextReserveStatus = RESERVE_STATUSES.APPROVED;

      if (nextLockedAmount > 0) {
        nextReserveStatus = RESERVE_STATUSES.LOCKED;
      } else if (nextLockedAmount <= 0 && nextAvailableAmount <= 0) {
        nextReserveStatus = RESERVE_STATUSES.CONSUMED;
      }

      await tx.reserveLedger.update({
        where: { id: settlement.reserveLedgerId },
        data: {
          lockedAmount: {
            decrement: settlement.amount,
          },
          consumedAmount: {
            increment: settlement.amount,
          },
          status: nextReserveStatus,
          consumedAt: new Date(),
        },
      });

      await createReserveAuditLog({
        actorUserId,
        entityId: settlement.reserveLedgerId,
        action: AUDIT_ACTIONS.RESERVE_CONSUME,
        metadata: {
          settlementRequestId: settlement.id,
          consumedAmount: settlement.amount,
          totalConsumedAmount: String(nextConsumedAmount),
        },
      }, tx);
    }

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.RECORD_EXECUTION,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.SETTLED,
        txSignature: executionResult.txSignature,
        explorerUrl: executionResult.explorerUrl,
        onChainRequestAddress: executionResult.onChainRequestAddress,
        createSignature: executionResult.createSignature,
        approveSignature: executionResult.approveSignature,
        destinationTokenAccount: executionResult.destinationTokenAccount,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.SETTLED,
      },
    }, tx);

    return updatedSettlement;
  });

  return hydrateSettlement(executed);
}

async function prepareMintSettlementRequest(id, actorUser, makerWalletAddress) {
  const settlement = await getSettlementOrThrow(id);
  if (!isMintSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports mint settlements');
  }

  if (![SETTLEMENT_STATUSES.DRAFT, SETTLEMENT_STATUSES.PENDING_APPROVAL].includes(settlement.status)) {
    throw new ApiError(
      400,
      `Only DRAFT or PENDING_APPROVAL settlements can be prepared for maker wallet initiation. Current status is ${settlement.status}.`,
    );
  }

  const treasuryTokenAccount = await getTreasuryTokenAccountOrThrow(settlement);
  if (settlement.reserveLedgerId) {
    const reserveLedger = await getReserveLedgerOrThrow(settlement.reserveLedgerId);
    requirePaymentBackedReserve(reserveLedger);
    ensureReserveAvailable(reserveLedger, settlement.amount);
  }
  const payload = solanaService.getMintSettlementExecutionContext(
    {
      ...settlement,
      makerWalletAddress: makerWalletAddress || settlement.makerWalletAddress || null,
    },
    treasuryTokenAccount.treasuryWalletAddress,
    treasuryTokenAccount.tokenAccountAddress,
  );

  await createSettlementAuditLog({
    actorUserId: actorUser.id,
    entityId: settlement.id,
    action: AUDIT_ACTIONS.PREPARE_EXECUTION,
    metadata: {
      preparationType: 'MAKER_MINT_REQUEST',
      status: settlement.status,
      operation: payload.operation || 'MINT',
    },
  });

  return {
    ...payload,
    operation: 'MINT',
  };
}

async function prepareTransferSettlementRequest(id, actorUser, makerWalletAddress) {
  const settlement = await getSettlementOrThrow(id);
  if (!isOnChainTransferSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports on-chain transfer settlements');
  }

  if (![SETTLEMENT_STATUSES.DRAFT, SETTLEMENT_STATUSES.PENDING_APPROVAL].includes(settlement.status)) {
    throw new ApiError(
      400,
      `Only DRAFT or PENDING_APPROVAL settlements can be prepared for maker wallet initiation. Current status is ${settlement.status}.`,
    );
  }

  const { sourceTokenAccount, destinationTokenAccount } = await getTransferSettlementTokenAccountsOrThrow(settlement);
  const payload = solanaService.getTransferSettlementExecutionContext(
    {
      ...settlement,
      makerWalletAddress: makerWalletAddress || settlement.makerWalletAddress || null,
    },
    sourceTokenAccount.treasuryWalletAddress,
    sourceTokenAccount.tokenAccountAddress,
    destinationTokenAccount.treasuryWalletAddress,
    destinationTokenAccount.tokenAccountAddress,
  );

  await createSettlementAuditLog({
    actorUserId: actorUser.id,
    entityId: settlement.id,
    action: AUDIT_ACTIONS.PREPARE_EXECUTION,
    metadata: {
      preparationType: 'MAKER_TRANSFER_REQUEST',
      status: settlement.status,
      operation: 'TRANSFER',
    },
  });

  return {
    ...payload,
    operation: 'TRANSFER',
  };
}

async function prepareBurnSettlementRequest(id, actorUser, makerWalletAddress) {
  const settlement = await getSettlementOrThrow(id);
  if (!isBipsSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports BIPS-routed settlements');
  }

  if (!['00', '0000'].includes(String(settlement.inquiryResponseCode || ''))) {
    throw new ApiError(400, 'A successful BIPS account inquiry is required before burn initiation');
  }

  if (![SETTLEMENT_STATUSES.DRAFT, SETTLEMENT_STATUSES.PENDING_APPROVAL].includes(settlement.status)) {
    throw new ApiError(
      400,
      `Only DRAFT or PENDING_APPROVAL settlements can be prepared for maker wallet initiation. Current status is ${settlement.status}.`,
    );
  }

  const sourceTokenAccount = await getBurnSettlementTokenAccountOrThrow(settlement);
  const payload = solanaService.getBurnSettlementExecutionContext(
    {
      ...settlement,
      makerWalletAddress: makerWalletAddress || settlement.makerWalletAddress || null,
    },
    sourceTokenAccount.treasuryWalletAddress,
    sourceTokenAccount.tokenAccountAddress,
  );

  await createSettlementAuditLog({
    actorUserId: actorUser.id,
    entityId: settlement.id,
    action: AUDIT_ACTIONS.PREPARE_EXECUTION,
    metadata: {
      preparationType: 'MAKER_BURN_REQUEST',
      status: settlement.status,
      operation: 'BURN',
    },
  });

  return {
    ...payload,
    operation: 'BURN',
  };
}

async function prepareMintSettlementCheckerApproval(id, actorUser, checkerWalletAddress) {
  const settlement = await getSettlementOrThrow(id);
  if (!isMintSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports mint settlements');
  }

  if (settlement.status !== SETTLEMENT_STATUSES.PENDING_APPROVAL) {
    throw new ApiError(400, 'Only PENDING_APPROVAL mint settlements can be prepared for checker approval');
  }

  if (!settlement.onChainRequestAddress) {
    throw new ApiError(400, 'Maker wallet initiation must be recorded before checker approval can be prepared');
  }

  const treasuryTokenAccount = await getTreasuryTokenAccountOrThrow(settlement);
  const executionContext = solanaService.getMintSettlementExecutionContext(
    settlement,
    treasuryTokenAccount.treasuryWalletAddress,
    settlement.destinationTokenAccountAddress || treasuryTokenAccount.tokenAccountAddress,
  );

  const checkerAddress = checkerWalletAddress || null;
  if (!checkerAddress) {
    throw new ApiError(400, 'checkerWalletAddress is required for settlement checker approval preparation');
  }

  const instructionPayload = await solanaService.prepareSettlementMintApprovalInstruction({
    onChainRequestAddress: settlement.onChainRequestAddress,
    tokenMintAddress: settlement.tokenMintAddress,
    destinationTokenAccountAddress:
      settlement.destinationTokenAccountAddress || treasuryTokenAccount.tokenAccountAddress,
    checkerWalletAddress: checkerAddress,
  });

  const payload = {
    ...executionContext,
    ...instructionPayload,
    operation: 'APPROVE',
    expectedCheckerWalletAddress: checkerAddress,
    onChainRequestAddress: settlement.onChainRequestAddress,
  };

  await createSettlementAuditLog({
    actorUserId: actorUser.id,
    entityId: settlement.id,
    action: AUDIT_ACTIONS.PREPARE_EXECUTION,
    metadata: {
      preparationType: 'CHECKER_APPROVAL',
      status: settlement.status,
      operation: payload.operation,
      onChainRequestAddress: settlement.onChainRequestAddress,
    },
  });

  return payload;
}

async function prepareTransferSettlementCheckerApproval(id, actorUser, checkerWalletAddress) {
  const settlement = await getSettlementOrThrow(id);
  if (!isOnChainTransferSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports on-chain transfer settlements');
  }

  if (settlement.status !== SETTLEMENT_STATUSES.PENDING_APPROVAL) {
    throw new ApiError(400, 'Only PENDING_APPROVAL transfer settlements can be prepared for checker approval');
  }

  if (!settlement.onChainRequestAddress) {
    throw new ApiError(400, 'Maker wallet initiation must be recorded before checker approval can be prepared');
  }

  const { sourceTokenAccount, destinationTokenAccount } = await getTransferSettlementTokenAccountsOrThrow(settlement);
  const checkerAddress = checkerWalletAddress || null;
  if (!checkerAddress) {
    throw new ApiError(400, 'checkerWalletAddress is required for settlement checker approval preparation');
  }

  const executionContext = solanaService.getTransferSettlementExecutionContext(
    settlement,
    sourceTokenAccount.treasuryWalletAddress,
    settlement.sourceTokenAccountAddress || sourceTokenAccount.tokenAccountAddress,
    destinationTokenAccount.treasuryWalletAddress,
    settlement.destinationTokenAccountAddress || destinationTokenAccount.tokenAccountAddress,
  );

  const instructionPayload = await solanaService.prepareSettlementTransferApprovalInstruction({
    onChainRequestAddress: settlement.onChainRequestAddress,
    tokenMintAddress: settlement.tokenMintAddress,
    sourceTokenAccountAddress: settlement.sourceTokenAccountAddress || sourceTokenAccount.tokenAccountAddress,
    destinationTokenAccountAddress: settlement.destinationTokenAccountAddress || destinationTokenAccount.tokenAccountAddress,
    checkerWalletAddress: checkerAddress,
  });

  const payload = {
    ...executionContext,
    ...instructionPayload,
    operation: 'APPROVE',
    expectedCheckerWalletAddress: checkerAddress,
    onChainRequestAddress: settlement.onChainRequestAddress,
  };

  await createSettlementAuditLog({
    actorUserId: actorUser.id,
    entityId: settlement.id,
    action: AUDIT_ACTIONS.PREPARE_EXECUTION,
    metadata: {
      preparationType: 'CHECKER_TRANSFER_APPROVAL',
      status: settlement.status,
      operation: payload.operation,
      onChainRequestAddress: settlement.onChainRequestAddress,
    },
  });

  return payload;
}

async function prepareBurnSettlementCheckerApproval(id, actorUser, checkerWalletAddress) {
  const settlement = await getSettlementOrThrow(id);
  if (!isBipsSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports BIPS-routed settlements');
  }

  if (settlement.status !== SETTLEMENT_STATUSES.PENDING_APPROVAL) {
    throw new ApiError(400, 'Only PENDING_APPROVAL burn settlements can be prepared for checker approval');
  }

  if (!settlement.onChainRequestAddress) {
    throw new ApiError(400, 'Maker wallet initiation must be recorded before checker approval can be prepared');
  }

  const sourceTokenAccount = await getBurnSettlementTokenAccountOrThrow(settlement);
  const checkerAddress = checkerWalletAddress || null;
  if (!checkerAddress) {
    throw new ApiError(400, 'checkerWalletAddress is required for settlement checker approval preparation');
  }

  const executionContext = solanaService.getBurnSettlementExecutionContext(
    settlement,
    sourceTokenAccount.treasuryWalletAddress,
    settlement.sourceTokenAccountAddress || sourceTokenAccount.tokenAccountAddress,
  );

  const instructionPayload = await solanaService.prepareSettlementBurnApprovalInstruction({
    onChainRequestAddress: settlement.onChainRequestAddress,
    tokenMintAddress: settlement.tokenMintAddress,
    sourceTokenAccountAddress: settlement.sourceTokenAccountAddress || sourceTokenAccount.tokenAccountAddress,
    checkerWalletAddress: checkerAddress,
  });

  const payload = {
    ...executionContext,
    ...instructionPayload,
    operation: 'APPROVE',
    expectedCheckerWalletAddress: checkerAddress,
    onChainRequestAddress: settlement.onChainRequestAddress,
  };

  await createSettlementAuditLog({
    actorUserId: actorUser.id,
    entityId: settlement.id,
    action: AUDIT_ACTIONS.PREPARE_EXECUTION,
    metadata: {
      preparationType: 'CHECKER_BURN_APPROVAL',
      status: settlement.status,
      operation: payload.operation,
      onChainRequestAddress: settlement.onChainRequestAddress,
    },
  });

  return payload;
}

async function recordMintSettlementInitiation(id, payload, actorUserId) {
  const settlement = await getSettlementOrThrow(id);
  if (!isMintSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports mint settlements');
  }

  if (![SETTLEMENT_STATUSES.DRAFT, SETTLEMENT_STATUSES.PENDING_APPROVAL].includes(settlement.status)) {
    throw new ApiError(400, `Settlement cannot record initiation from status ${settlement.status}`);
  }

  const treasuryTokenAccount = await getTreasuryTokenAccountOrThrow(settlement);
  const requestShape = buildMintSettlementRequestShape(
    {
      ...settlement,
      makerWalletAddress: payload.makerWalletAddress,
      destinationTokenAccountAddress:
        payload.destinationTokenAccountAddress || treasuryTokenAccount.tokenAccountAddress,
    },
    treasuryTokenAccount,
  );

  await solanaService.validateRecordedOnChainRequest(requestShape, {
    makerWalletAddress: payload.makerWalletAddress,
    onChainRequestAddress: payload.onChainRequestAddress,
    destinationTokenAccountAddress:
      payload.destinationTokenAccountAddress || treasuryTokenAccount.tokenAccountAddress,
  }, {
    requirePendingStatus: true,
  });

  const updated = await prisma.$transaction(async (tx) => {
    if (settlement.reserveLedgerId) {
      const reserveLedger = await tx.reserveLedger.findUnique({
        where: { id: settlement.reserveLedgerId },
      });

      ensureReserveAvailable(reserveLedger, settlement.amount);
      requirePaymentBackedReserve(reserveLedger);

      await tx.reserveLedger.update({
        where: { id: settlement.reserveLedgerId },
        data: {
          availableAmount: {
            decrement: settlement.amount,
          },
          lockedAmount: {
            increment: settlement.amount,
          },
          status: getReserveStatusAfterLock(reserveLedger, settlement.amount),
        },
      });

      await createReserveAuditLog({
        actorUserId,
        entityId: settlement.reserveLedgerId,
        action: AUDIT_ACTIONS.RESERVE_APPROVE,
        metadata: {
          settlementRequestId: settlement.id,
          lockedAmount: settlement.amount,
          reason: 'Reserve-backed mint initiation recorded and reserve capacity locked',
        },
      }, tx);
    }

    const nextSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        status: SETTLEMENT_STATUSES.PENDING_APPROVAL,
        makerWalletAddress: payload.makerWalletAddress,
        onChainRequestAddress: payload.onChainRequestAddress,
        initiationTxSignature: payload.initiationTxSignature,
        initiationExplorerUrl: payload.initiationExplorerUrl || null,
        destinationTokenAccountAddress:
          payload.destinationTokenAccountAddress || treasuryTokenAccount.tokenAccountAddress,
        makerInitiatedAt: new Date(),
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.RECORD_INITIATION,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.PENDING_APPROVAL,
        makerWalletAddress: payload.makerWalletAddress,
        onChainRequestAddress: payload.onChainRequestAddress,
        initiationTxSignature: payload.initiationTxSignature,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.PENDING_APPROVAL,
      },
    }, tx);

    return nextSettlement;
  });

  return hydrateSettlement(updated);
}

async function recordTransferSettlementInitiation(id, payload, actorUserId) {
  const settlement = await getSettlementOrThrow(id);
  if (!isOnChainTransferSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports on-chain transfer settlements');
  }

  if (![SETTLEMENT_STATUSES.DRAFT, SETTLEMENT_STATUSES.PENDING_APPROVAL].includes(settlement.status)) {
    throw new ApiError(400, `Settlement cannot record initiation from status ${settlement.status}`);
  }

  const { sourceTokenAccount, destinationTokenAccount } = await getTransferSettlementTokenAccountsOrThrow(settlement);
  const requestShape = buildTransferSettlementRequestShape(
    {
      ...settlement,
      makerWalletAddress: payload.makerWalletAddress,
      sourceTokenAccountAddress:
        payload.sourceTokenAccountAddress || sourceTokenAccount.tokenAccountAddress,
      destinationTokenAccountAddress:
        payload.destinationTokenAccountAddress || destinationTokenAccount.tokenAccountAddress,
    },
    sourceTokenAccount,
    destinationTokenAccount,
  );

  await solanaService.validateRecordedOnChainRequest(requestShape, {
    makerWalletAddress: payload.makerWalletAddress,
    onChainRequestAddress: payload.onChainRequestAddress,
    sourceTokenAccountAddress:
      payload.sourceTokenAccountAddress || sourceTokenAccount.tokenAccountAddress,
    destinationTokenAccountAddress:
      payload.destinationTokenAccountAddress || destinationTokenAccount.tokenAccountAddress,
  }, {
    requirePendingStatus: true,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const nextSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        status: SETTLEMENT_STATUSES.PENDING_APPROVAL,
        makerWalletAddress: payload.makerWalletAddress,
        onChainRequestAddress: payload.onChainRequestAddress,
        initiationTxSignature: payload.initiationTxSignature,
        initiationExplorerUrl: payload.initiationExplorerUrl || null,
        sourceTokenAccountAddress:
          payload.sourceTokenAccountAddress || sourceTokenAccount.tokenAccountAddress,
        destinationTokenAccountAddress:
          payload.destinationTokenAccountAddress || destinationTokenAccount.tokenAccountAddress,
        makerInitiatedAt: new Date(),
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.RECORD_INITIATION,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.PENDING_APPROVAL,
        makerWalletAddress: payload.makerWalletAddress,
        onChainRequestAddress: payload.onChainRequestAddress,
        initiationTxSignature: payload.initiationTxSignature,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.PENDING_APPROVAL,
      },
    }, tx);

    return nextSettlement;
  });

  return hydrateSettlement(updated);
}

async function recordBurnSettlementInitiation(id, payload, actorUserId) {
  const settlement = await getSettlementOrThrow(id);
  if (!isBipsSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports BIPS-routed settlements');
  }

  if (![SETTLEMENT_STATUSES.DRAFT, SETTLEMENT_STATUSES.PENDING_APPROVAL].includes(settlement.status)) {
    throw new ApiError(400, `Settlement cannot record initiation from status ${settlement.status}`);
  }

  const sourceTokenAccount = await getBurnSettlementTokenAccountOrThrow(settlement);
  const requestShape = buildBurnSettlementRequestShape(
    {
      ...settlement,
      makerWalletAddress: payload.makerWalletAddress,
      sourceTokenAccountAddress:
        payload.sourceTokenAccountAddress || sourceTokenAccount.tokenAccountAddress,
    },
    sourceTokenAccount,
  );

  await solanaService.validateRecordedOnChainRequest(requestShape, {
    makerWalletAddress: payload.makerWalletAddress,
    onChainRequestAddress: payload.onChainRequestAddress,
    sourceTokenAccountAddress:
      payload.sourceTokenAccountAddress || sourceTokenAccount.tokenAccountAddress,
  }, {
    requirePendingStatus: true,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const nextSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        status: SETTLEMENT_STATUSES.PENDING_APPROVAL,
        makerWalletAddress: payload.makerWalletAddress,
        onChainRequestAddress: payload.onChainRequestAddress,
        initiationTxSignature: payload.initiationTxSignature,
        initiationExplorerUrl: payload.initiationExplorerUrl || null,
        sourceTokenAccountAddress:
          payload.sourceTokenAccountAddress || sourceTokenAccount.tokenAccountAddress,
        makerInitiatedAt: new Date(),
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.RECORD_INITIATION,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.PENDING_APPROVAL,
        makerWalletAddress: payload.makerWalletAddress,
        onChainRequestAddress: payload.onChainRequestAddress,
        initiationTxSignature: payload.initiationTxSignature,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: SETTLEMENT_STATUSES.PENDING_APPROVAL,
      },
    }, tx);

    return nextSettlement;
  });

  return hydrateSettlement(updated);
}

async function recordMintSettlementExecution(id, payload, actorUserId) {
  const settlement = await getSettlementOrThrow(id);
  if (!isMintSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports mint settlements');
  }

  if (settlement.status !== SETTLEMENT_STATUSES.PENDING_APPROVAL) {
    throw new ApiError(400, 'Only PENDING_APPROVAL mint settlements can record execution');
  }

  if (payload.status === SETTLEMENT_STATUSES.FAILED && !payload.executionError) {
    throw new ApiError(400, 'executionError is required when status is FAILED');
  }

  const treasuryTokenAccount = await getTreasuryTokenAccountOrThrow(settlement);
  const requestShape = buildMintSettlementRequestShape(settlement, treasuryTokenAccount);

  if (payload.status === SETTLEMENT_STATUSES.SETTLED) {
    if (settlement.reserveLedgerId) {
      const reserveLedger = await getReserveLedgerOrThrow(settlement.reserveLedgerId);
      requirePaymentBackedReserve(reserveLedger);
    }
    const onChainRequest = await solanaService.validateRecordedOnChainRequest(requestShape);
    await solanaService.verifyConfirmedTransaction(
      payload.txSignature,
      [settlement.onChainRequestAddress, settlement.tokenMintAddress],
    );

    if (onChainRequest.status !== 'APPROVED') {
      throw new ApiError(
        409,
        `On-chain request status is ${onChainRequest.status || 'UNKNOWN'}. It must be APPROVED before the settlement can be recorded as SETTLED.`,
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (payload.status === SETTLEMENT_STATUSES.SETTLED && settlement.reserveLedgerId) {
      const reserveLedger = await tx.reserveLedger.findUnique({
        where: { id: settlement.reserveLedgerId },
      });

      requirePaymentBackedReserve(reserveLedger);
      const nextReserveStatus = getReserveStatusAfterConsume(reserveLedger, settlement.amount);

      await tx.reserveLedger.update({
        where: { id: settlement.reserveLedgerId },
        data: {
          lockedAmount: {
            decrement: settlement.amount,
          },
          consumedAmount: {
            increment: settlement.amount,
          },
          status: nextReserveStatus,
          consumedAt: new Date(),
        },
      });

      await createReserveAuditLog({
        actorUserId,
        entityId: settlement.reserveLedgerId,
        action: AUDIT_ACTIONS.RESERVE_CONSUME,
        metadata: {
          settlementRequestId: settlement.id,
          consumedAmount: settlement.amount,
        },
      }, tx);
    }

    if (payload.status === SETTLEMENT_STATUSES.FAILED && settlement.reserveLedgerId) {
      const reserveLedger = await tx.reserveLedger.findUnique({
        where: { id: settlement.reserveLedgerId },
      });

      requirePaymentBackedReserve(reserveLedger);

      await tx.reserveLedger.update({
        where: { id: settlement.reserveLedgerId },
        data: {
          availableAmount: {
            increment: settlement.amount,
          },
          lockedAmount: {
            decrement: settlement.amount,
          },
          status: getReserveStatusAfterRelease(reserveLedger, settlement.amount),
        },
      });
    }

    const nextSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        status: payload.status,
        txSignature: payload.txSignature || null,
        explorerUrl: payload.explorerUrl || null,
        executionError: payload.status === SETTLEMENT_STATUSES.SETTLED ? null : payload.executionError,
        settledAt: payload.status === SETTLEMENT_STATUSES.SETTLED ? new Date() : null,
        executedAt: payload.status === SETTLEMENT_STATUSES.SETTLED ? new Date() : null,
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.RECORD_EXECUTION,
      metadata: {
        previousStatus: settlement.status,
        newStatus: payload.status,
        txSignature: payload.txSignature || null,
        explorerUrl: payload.explorerUrl || null,
        executionError: payload.executionError || null,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: payload.status,
      },
    }, tx);

    return nextSettlement;
  });

  return hydrateSettlement(updated);
}

async function recordTransferSettlementExecution(id, payload, actorUserId) {
  const settlement = await getSettlementOrThrow(id);
  if (!isOnChainTransferSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports on-chain transfer settlements');
  }

  if (settlement.status !== SETTLEMENT_STATUSES.PENDING_APPROVAL) {
    throw new ApiError(400, 'Only PENDING_APPROVAL transfer settlements can record execution');
  }

  if (payload.status === SETTLEMENT_STATUSES.FAILED && !payload.executionError) {
    throw new ApiError(400, 'executionError is required when status is FAILED');
  }

  const { sourceTokenAccount, destinationTokenAccount } = await getTransferSettlementTokenAccountsOrThrow(settlement);
  const requestShape = buildTransferSettlementRequestShape(settlement, sourceTokenAccount, destinationTokenAccount);

  if (payload.status === SETTLEMENT_STATUSES.SETTLED) {
    const onChainRequest = await solanaService.validateRecordedOnChainRequest(requestShape);
    await solanaService.verifyConfirmedTransaction(
      payload.txSignature,
      [settlement.onChainRequestAddress, settlement.tokenMintAddress],
    );

    if (onChainRequest.status !== 'APPROVED') {
      throw new ApiError(
        409,
        `On-chain request status is ${onChainRequest.status || 'UNKNOWN'}. It must be APPROVED before the settlement can be recorded as SETTLED.`,
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        status: payload.status,
        txSignature: payload.txSignature || null,
        explorerUrl: payload.explorerUrl || null,
        executionError: payload.status === SETTLEMENT_STATUSES.SETTLED ? null : payload.executionError,
        settledAt: payload.status === SETTLEMENT_STATUSES.SETTLED ? new Date() : null,
        executedAt: payload.status === SETTLEMENT_STATUSES.SETTLED ? new Date() : null,
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.RECORD_EXECUTION,
      metadata: {
        previousStatus: settlement.status,
        newStatus: payload.status,
        txSignature: payload.txSignature || null,
        explorerUrl: payload.explorerUrl || null,
        executionError: payload.executionError || null,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: payload.status,
      },
    }, tx);

    return nextSettlement;
  });

  return hydrateSettlement(updated);
}

async function runSettlementInquiry(id, actorUserId) {
  const settlement = await getSettlementOrThrow(id);
  if (!isBipsSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports BIPS-routed settlements');
  }

  if (!settlement.beneficiaryAccountNumber || !settlement.beneficiaryBankCode) {
    throw new ApiError(400, 'Beneficiary account details are required for BIPS inquiry');
  }

  if (!settlement.sourceAccountName || !settlement.sourceAccountNumber) {
    throw new ApiError(400, 'Source account details are required for BIPS inquiry');
  }

  const inquiryResult = await bipsService.accountInquiry({
    amount: settlement.amount,
    beneficiaryAccountNumber: settlement.beneficiaryAccountNumber,
    beneficiaryBankCode: settlement.beneficiaryBankCode,
    sourceAccountName: settlement.sourceAccountName,
    sourceAccountNumber: settlement.sourceAccountNumber,
    sourceBankCode: settlement.sourceBank?.code || null,
    transferPurpose: settlement.transferPurpose || 'Settlement inquiry',
    requestId: settlement.requestId || `settlement-${settlement.id}`,
    settlementRequestId: settlement.id,
  });

  const responseCode = inquiryResult.parsedResponse?.embeddedResponse?.ResponseCode
    || inquiryResult.parsedResponse?.responseCode
    || null;
  const responseMessage = inquiryResult.parsedResponse?.responseText || null;
  const referenceNumber = inquiryResult.parsedResponse?.embeddedResponse?.RetrievalReferenceNumber || null;
  const success = ['00', '0000'].includes(String(responseCode || ''));

  const updated = await prisma.$transaction(async (tx) => {
    const nextSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        status: success ? SETTLEMENT_STATUSES.DRAFT : SETTLEMENT_STATUSES.INQUIRY_FAILED,
        inquiryResponseCode: responseCode,
        inquiryResponseMessage: responseMessage,
        referenceNumber: referenceNumber || settlement.referenceNumber || null,
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.BIPS_INQUIRY,
      metadata: {
        responseCode,
        responseMessage,
        referenceNumber,
        logId: inquiryResult.logId,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: success ? SETTLEMENT_STATUSES.DRAFT : SETTLEMENT_STATUSES.INQUIRY_FAILED,
      },
    }, tx);

    return nextSettlement;
  });

  return hydrateSettlement(updated);
}

async function recordBurnSettlementExecution(id, payload, actorUserId) {
  const settlement = await getSettlementOrThrow(id);
  if (!isBipsSettlement(settlement)) {
    throw new ApiError(400, 'This endpoint only supports BIPS-routed settlements');
  }

  if (settlement.status !== SETTLEMENT_STATUSES.PENDING_APPROVAL) {
    throw new ApiError(400, 'Only PENDING_APPROVAL burn settlements can record execution');
  }

  if (payload.status === SETTLEMENT_STATUSES.FAILED && !payload.executionError) {
    throw new ApiError(400, 'executionError is required when status is FAILED');
  }

  const sourceTokenAccount = await getBurnSettlementTokenAccountOrThrow(settlement);
  const requestShape = buildBurnSettlementRequestShape(settlement, sourceTokenAccount);

  if (payload.status === SETTLEMENT_STATUSES.SETTLED) {
    if (!['00', '0000'].includes(String(settlement.inquiryResponseCode || ''))) {
      throw new ApiError(400, 'A successful BIPS account inquiry is required before recording burn execution');
    }

    const onChainRequest = await solanaService.validateRecordedOnChainRequest(requestShape);
    await solanaService.verifyConfirmedTransaction(
      payload.txSignature,
      [settlement.onChainRequestAddress, settlement.tokenMintAddress],
    );

    if (onChainRequest.status !== 'APPROVED') {
      throw new ApiError(
        409,
        `On-chain request status is ${onChainRequest.status || 'UNKNOWN'}. It must be APPROVED before the settlement can proceed to BIPS outgoing.`,
      );
    }
  }

  if (payload.status === SETTLEMENT_STATUSES.FAILED) {
    const failed = await prisma.$transaction(async (tx) => {
      const nextSettlement = await tx.settlementRequest.update({
        where: { id },
        data: {
          status: SETTLEMENT_STATUSES.FAILED,
          executionError: payload.executionError,
          txSignature: payload.txSignature || null,
          explorerUrl: payload.explorerUrl || null,
        },
        include: settlementInclude,
      });

      await createSettlementAuditLog({
        actorUserId,
        entityId: id,
        action: AUDIT_ACTIONS.RECORD_EXECUTION,
        metadata: {
          previousStatus: settlement.status,
          newStatus: SETTLEMENT_STATUSES.FAILED,
          txSignature: payload.txSignature || null,
          explorerUrl: payload.explorerUrl || null,
          executionError: payload.executionError,
        },
      }, tx);

      await createSettlementAuditLog({
        actorUserId,
        entityId: id,
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        metadata: {
          previousStatus: settlement.status,
          newStatus: SETTLEMENT_STATUSES.FAILED,
        },
      }, tx);

      return nextSettlement;
    });

    return hydrateSettlement(failed);
  }

  let outgoingResult;
  let outgoingCode = null;
  let outgoingMessage = null;
  let nextStatus = SETTLEMENT_STATUSES.BIPS_PENDING;
  let executionError = null;

  try {
    outgoingResult = await bipsService.outgoingTransfer({
      amount: settlement.amount,
      beneficiaryAccountName: settlement.beneficiaryAccountName,
      beneficiaryAccountNumber: settlement.beneficiaryAccountNumber,
      beneficiaryBankCode: settlement.beneficiaryBankCode,
      sourceAccountName: settlement.sourceAccountName,
      sourceAccountNumber: settlement.sourceAccountNumber,
      sourceBankCode: settlement.sourceBank?.code || null,
      transferPurpose: settlement.transferPurpose || 'Settlement outgoing',
      requestId: settlement.requestId || `settlement-${settlement.id}`,
      referenceNumber: settlement.referenceNumber,
      settlementRequestId: settlement.id,
    });
    outgoingCode = outgoingResult.parsedResponse?.embeddedResponse?.ResponseCode
      || outgoingResult.parsedResponse?.responseCode
      || null;
    outgoingMessage = outgoingResult.parsedResponse?.responseText || null;
    if (!['00', '0000'].includes(String(outgoingCode || ''))) {
      nextStatus = SETTLEMENT_STATUSES.MANUAL_REVIEW;
      executionError = `BIPS outgoing did not confirm success. Response code: ${outgoingCode || 'UNKNOWN'}`;
    }
  } catch (error) {
    nextStatus = SETTLEMENT_STATUSES.MANUAL_REVIEW;
    executionError = error.message;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        txSignature: payload.txSignature || null,
        explorerUrl: payload.explorerUrl || null,
        executionError,
        bipsTransactionId: outgoingResult?.parsedResponse?.msgRefNo || settlement.bipsTransactionId || null,
        referenceNumber:
          settlement.referenceNumber
          || outgoingResult?.parsedResponse?.embeddedResponse?.RetrievalReferenceNumber
          || settlement.referenceNumber,
        executedAt: new Date(),
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.BIPS_OUTGOING,
      metadata: {
        responseCode: outgoingCode,
        responseMessage: outgoingMessage,
        nextStatus,
        logId: outgoingResult?.logId || null,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.RECORD_EXECUTION,
      metadata: {
        previousStatus: settlement.status,
        newStatus: nextStatus,
        txSignature: payload.txSignature || null,
        explorerUrl: payload.explorerUrl || null,
        executionError,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: nextStatus,
      },
    }, tx);

    return nextSettlement;
  });

  return hydrateSettlement(updated);
}

async function reconcileSettlement(id, actorUserId = null) {
  const settlement = await getSettlementOrThrow(id);

  if (!isBipsSettlement(settlement)) {
    throw new ApiError(400, 'Only BIPS-routed settlements can be reconciled');
  }

  if (![SETTLEMENT_STATUSES.BIPS_PENDING, SETTLEMENT_STATUSES.MANUAL_REVIEW].includes(settlement.status)) {
    throw new ApiError(400, `Settlement cannot be reconciled from status ${settlement.status}`);
  }

  const reconciliationErrors = [];
  let pgStatusResult = null;
  let liveInquiryResult = null;

  if (settlement.bipsTransactionId) {
    try {
      pgStatusResult = await bipsService.getPgStatus({
        settlementRequestId: settlement.id,
        requestId: settlement.requestId,
        transactionId: settlement.bipsTransactionId,
      });
    } catch (error) {
      reconciliationErrors.push(`PG status check failed: ${error.message}`);
    }
  } else {
    reconciliationErrors.push('PG status check skipped because bipsTransactionId is missing');
  }

  if (settlement.requestId || settlement.referenceNumber || settlement.bipsTransactionId) {
    try {
      liveInquiryResult = await bipsService.liveInquiry({
        settlementRequestId: settlement.id,
        requestId: settlement.requestId,
        referenceNumber: settlement.referenceNumber,
        transactionId: settlement.bipsTransactionId,
      });
    } catch (error) {
      reconciliationErrors.push(`Live inquiry failed: ${error.message}`);
    }
  } else {
    reconciliationErrors.push('Live inquiry skipped because no BIPS identifiers are available');
  }

  const assessments = [
    assessBipsReconciliationResult(pgStatusResult, 'PG_STATUS'),
    assessBipsReconciliationResult(liveInquiryResult, 'LIVE_INQUIRY'),
  ];

  const nextStatus = resolveReconciledSettlementStatus(settlement.status, assessments);
  const executionError = buildReconciliationErrorMessage(nextStatus, assessments, reconciliationErrors);

  const updated = await prisma.$transaction(async (tx) => {
    const nextSettlement = await tx.settlementRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        executionError,
        settledAt: nextStatus === SETTLEMENT_STATUSES.SETTLED ? new Date() : settlement.settledAt,
      },
      include: settlementInclude,
    });

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.BIPS_RECONCILE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: nextStatus,
        pgStatusLogId: pgStatusResult?.logId || null,
        liveInquiryLogId: liveInquiryResult?.logId || null,
        assessments,
        reconciliationErrors,
      },
    }, tx);

    await createSettlementAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: settlement.status,
        newStatus: nextStatus,
      },
    }, tx);

    return nextSettlement;
  });

  return {
    settlement: await hydrateSettlement(updated),
    reconciliation: {
      assessments,
      reconciliationErrors,
      pgStatusLogId: pgStatusResult?.logId || null,
      liveInquiryLogId: liveInquiryResult?.logId || null,
    },
  };
}

async function reconcilePendingSettlements(options = {}, actorUserId = null) {
  const includeManualReview = options.includeManualReview ?? false;
  const limit = options.limit ?? 20;
  const statuses = includeManualReview
    ? [SETTLEMENT_STATUSES.BIPS_PENDING, SETTLEMENT_STATUSES.MANUAL_REVIEW]
    : [SETTLEMENT_STATUSES.BIPS_PENDING];

  const settlements = await prisma.settlementRequest.findMany({
    where: {
      settlementMode: SETTLEMENT_MODES.BIPS_FIAT,
      status: {
        in: statuses,
      },
    },
    include: settlementInclude,
    orderBy: [
      { executedAt: 'asc' },
      { updatedAt: 'asc' },
    ],
    take: limit,
  });

  const results = [];
  for (const settlement of settlements) {
    try {
      const result = await reconcileSettlement(settlement.id, actorUserId);
      results.push({
        settlementId: settlement.id,
        ok: true,
        status: result.settlement.status,
        reconciliation: result.reconciliation,
      });
    } catch (error) {
      results.push({
        settlementId: settlement.id,
        ok: false,
        error: error.message,
      });
    }
  }

  return {
    total: settlements.length,
    succeeded: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };
}

module.exports = {
  createReserveMintRequest,
  createReplenishmentMintRequest,
  createInterbankTransferRequest,
  createRedemptionRequest,
  listSettlements,
  getSettlementById,
  routeSettlement,
  prepareMintSettlementRequest,
  prepareTransferSettlementRequest,
  prepareBurnSettlementRequest,
  prepareMintSettlementCheckerApproval,
  prepareTransferSettlementCheckerApproval,
  prepareBurnSettlementCheckerApproval,
  recordMintSettlementInitiation,
  recordTransferSettlementInitiation,
  recordBurnSettlementInitiation,
  recordMintSettlementExecution,
  recordTransferSettlementExecution,
  runSettlementInquiry,
  recordBurnSettlementExecution,
  reconcileSettlement,
  reconcilePendingSettlements,
  approveSettlement,
  rejectSettlement,
  markSettlementReadyForExecution,
  executeSettlement,
};
