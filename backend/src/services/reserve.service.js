const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../utils/enums');
const auditLogService = require('./auditLog.service');
const { buildPagination, getPagination, getSortOptions } = require('../utils/pagination');

const RESERVE_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

const PAYMENT_GATEWAY_REFERENCE_TYPE = 'PAYMENT_GATEWAY';
const DK_BANK_CODE = '1060';

async function createReserveAuditLog({ actorUserId = null, entityId, action, metadata }, tx = prisma) {
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

async function getIssuerBank(tx = prisma) {
  const issuerBank = await tx.bank.findFirst({
    where: {
      OR: [
        { isIssuer: true },
        { code: DK_BANK_CODE },
      ],
    },
    orderBy: [
      { isIssuer: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  if (!issuerBank) {
    throw new ApiError(404, 'Issuer bank was not found. DK Bank must be configured before syncing reserve.');
  }

  return issuerBank;
}

async function findReserveByPaymentReference(paymentReference, tx = prisma) {
  const issuerBank = await getIssuerBank(tx);

  return tx.reserveLedger.findUnique({
    where: {
      bankId_referenceType_referenceId: {
        bankId: issuerBank.id,
        referenceType: PAYMENT_GATEWAY_REFERENCE_TYPE,
        referenceId: paymentReference,
      },
    },
  });
}

async function hydrateReserveLedger(reserveLedger, tx = prisma) {
  if (!reserveLedger) {
    return reserveLedger;
  }

  const paymentTransaction = reserveLedger.referenceType === PAYMENT_GATEWAY_REFERENCE_TYPE
    ? await tx.paymentTransaction.findUnique({
        where: {
          paymentReference: reserveLedger.referenceId,
        },
      })
    : null;

  return {
    ...reserveLedger,
    paymentTransaction,
  };
}

async function getReserveLedgerOrThrow(id, tx = prisma) {
  const reserveLedger = await tx.reserveLedger.findUnique({
    where: { id },
    include: {
      bank: true,
    },
  });

  if (!reserveLedger) {
    throw new ApiError(404, 'Reserve ledger not found');
  }

  return hydrateReserveLedger(reserveLedger, tx);
}

async function listReserves(query) {
  const { page, limit, skip } = getPagination(query);
  const orderBy = getSortOptions(
    query,
    ['createdAt', 'updatedAt', 'approvedAt', 'amount', 'availableAmount'],
    { createdAt: 'desc' },
  );

  const where = {
    ...(query.bankId ? { bankId: query.bankId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.referenceType
      ? {
          referenceType: {
            contains: query.referenceType,
            mode: 'insensitive',
          },
        }
      : {}),
  };

  const [items, totalItems] = await prisma.$transaction([
    prisma.reserveLedger.findMany({
      where,
      include: {
        bank: true,
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.reserveLedger.count({ where }),
  ]);

  const hydratedItems = await Promise.all(items.map((item) => hydrateReserveLedger(item)));

  return {
    items: hydratedItems,
    pagination: buildPagination({ page, limit, totalItems }),
  };
}

async function approveReserve(id, actorUserId) {
  const reserveLedger = await getReserveLedgerOrThrow(id);

  if (reserveLedger.status !== RESERVE_STATUSES.PENDING) {
    throw new ApiError(400, 'Only pending reserves can be approved');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextReserve = await tx.reserveLedger.update({
      where: { id },
      data: {
        status: RESERVE_STATUSES.APPROVED,
        approvedByUserId: actorUserId,
        approvedAt: new Date(),
      },
      include: {
        bank: true,
      },
    });

    await createReserveAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.RESERVE_APPROVE,
      metadata: {
        previousStatus: reserveLedger.status,
        newStatus: RESERVE_STATUSES.APPROVED,
        referenceType: reserveLedger.referenceType,
        referenceId: reserveLedger.referenceId,
      },
    }, tx);

    await createReserveAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: reserveLedger.status,
        newStatus: RESERVE_STATUSES.APPROVED,
      },
    }, tx);

    return nextReserve;
  });

  return hydrateReserveLedger(updated);
}

async function rejectReserve(id, payload, actorUserId) {
  const reserveLedger = await getReserveLedgerOrThrow(id);

  if (reserveLedger.status !== RESERVE_STATUSES.PENDING) {
    throw new ApiError(400, 'Only pending reserves can be rejected');
  }

  const nextRemarks = [reserveLedger.remarks, payload.rejectionReason].filter(Boolean).join(' | ');

  const updated = await prisma.$transaction(async (tx) => {
    const nextReserve = await tx.reserveLedger.update({
      where: { id },
      data: {
        status: RESERVE_STATUSES.REJECTED,
        remarks: nextRemarks || null,
      },
      include: {
        bank: true,
      },
    });

    await createReserveAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.REJECT,
      metadata: {
        previousStatus: reserveLedger.status,
        newStatus: RESERVE_STATUSES.REJECTED,
        rejectionReason: payload.rejectionReason,
        referenceType: reserveLedger.referenceType,
        referenceId: reserveLedger.referenceId,
      },
    }, tx);

    await createReserveAuditLog({
      actorUserId,
      entityId: id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      metadata: {
        previousStatus: reserveLedger.status,
        newStatus: RESERVE_STATUSES.REJECTED,
      },
    }, tx);

    return nextReserve;
  });

  return hydrateReserveLedger(updated);
}

async function syncReserveFromPaymentTransaction(paymentTransaction, actorUserId = null) {
  if (!paymentTransaction) {
    throw new ApiError(400, 'Payment transaction is required');
  }

  if (!['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'CONFIRMED', 'PAID'].includes(String(paymentTransaction.status || '').toUpperCase())) {
    return {
      reserveLedger: null,
      created: false,
      skipped: true,
      reason: `Payment status ${paymentTransaction.status} is not eligible for reserve creation`,
    };
  }

  return prisma.$transaction(async (tx) => {
    const issuerBank = await getIssuerBank(tx);

    const existingReserve = await tx.reserveLedger.findUnique({
      where: {
        bankId_referenceType_referenceId: {
          bankId: issuerBank.id,
          referenceType: PAYMENT_GATEWAY_REFERENCE_TYPE,
          referenceId: paymentTransaction.paymentReference,
        },
      },
    });

    if (existingReserve) {
      if (
        Number(existingReserve.amount) !== Number(paymentTransaction.amount)
        || String(existingReserve.currency) !== String(paymentTransaction.currency)
      ) {
        throw new ApiError(
          409,
          'Existing reserve entry does not match the confirmed payment transaction amount or currency',
        );
      }

      return {
        reserveLedger: existingReserve,
        created: false,
        skipped: false,
        reason: 'Reserve entry already exists for this payment reference',
      };
    }

    const reserveLedger = await tx.reserveLedger.create({
      data: {
        bankId: issuerBank.id,
        referenceType: PAYMENT_GATEWAY_REFERENCE_TYPE,
        referenceId: paymentTransaction.paymentReference,
        currency: paymentTransaction.currency,
        amount: paymentTransaction.amount,
        availableAmount: paymentTransaction.amount,
        lockedAmount: 0,
        consumedAmount: 0,
        status: RESERVE_STATUSES.PENDING,
        remarks: [
          `Created from ${paymentTransaction.gatewayName} payment confirmation`,
          paymentTransaction.customerReference ? `Customer ref: ${paymentTransaction.customerReference}` : null,
          paymentTransaction.gatewayTransactionId ? `Gateway tx: ${paymentTransaction.gatewayTransactionId}` : null,
        ].filter(Boolean).join(' | '),
      },
    });

    await createReserveAuditLog({
      actorUserId,
      entityId: reserveLedger.id,
      action: AUDIT_ACTIONS.CREATE,
      metadata: {
        bankId: issuerBank.id,
        paymentReference: paymentTransaction.paymentReference,
        gatewayName: paymentTransaction.gatewayName,
        paymentTransactionId: paymentTransaction.id,
        amount: paymentTransaction.amount,
        currency: paymentTransaction.currency,
        status: reserveLedger.status,
      },
    }, tx);

    return {
      reserveLedger,
      created: true,
      skipped: false,
      reason: 'Reserve entry created from confirmed payment transaction',
    };
  });
}

module.exports = {
  PAYMENT_GATEWAY_REFERENCE_TYPE,
  getReserveLedgerOrThrow,
  listReserves,
  approveReserve,
  rejectReserve,
  findReserveByPaymentReference,
  syncReserveFromPaymentTransaction,
};
