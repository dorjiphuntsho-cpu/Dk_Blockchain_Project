const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../utils/enums');
const auditLogService = require('./auditLog.service');
const reserveService = require('./reserve.service');
const {
  normalizePaymentPayload,
  isSuccessfulPaymentStatus,
  shouldReconcilePaymentTransaction,
} = require('./paymentPolicy.service');

function getFirstNonEmptyValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value === undefined || value === null) {
      continue;
    }

    const normalized = String(value).trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function toJsonSafeObject(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
    if (Array.isArray(entryValue)) {
      accumulator[key] = entryValue.map((item) => String(item));
      return accumulator;
    }

    if (entryValue === undefined) {
      return accumulator;
    }

    accumulator[key] = entryValue === null ? null : String(entryValue);
    return accumulator;
  }, {});
}


function buildStatusVerificationUrl(paymentReference) {
  if (!env.PAYMENT_GATEWAY_BASE_URL) {
    throw new ApiError(500, 'Payment gateway status verification is not configured');
  }

  const url = new URL(env.PAYMENT_GATEWAY_STATUS_PATH, env.PAYMENT_GATEWAY_BASE_URL);
  url.searchParams.set(env.PAYMENT_GATEWAY_STATUS_REFERENCE_QUERY_PARAM, paymentReference);
  return url.toString();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = env.PAYMENT_GATEWAY_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(408, 'Payment gateway request timed out');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertPaymentTransaction({
  normalized,
  rawCallbackPayload = undefined,
  rawCallbackHeaders = undefined,
  rawStatusResponse = undefined,
  parsedPayload = undefined,
  parsedStatus = undefined,
  markVerified = false,
}) {
  const existing = await prisma.paymentTransaction.findUnique({
    where: {
      paymentReference: normalized.paymentReference,
    },
  });

  const updateData = {
    gatewayName: normalized.gatewayName,
    gatewayTransactionId: normalized.gatewayTransactionId,
    customerReference: normalized.customerReference,
    payerName: normalized.payerName,
    payerAccount: normalized.payerAccount,
    amount: normalized.amount,
    currency: normalized.currency,
    status: normalized.status,
    statusMessage: normalized.statusMessage,
    ...(rawCallbackPayload !== undefined ? { rawCallbackPayload } : {}),
    ...(rawCallbackHeaders !== undefined ? { rawCallbackHeaders } : {}),
    ...(parsedPayload !== undefined ? { parsedPayload } : {}),
    ...(rawStatusResponse !== undefined ? { rawStatusResponse } : {}),
    ...(parsedStatus !== undefined ? { parsedStatus } : {}),
    ...(markVerified ? { lastVerifiedAt: new Date() } : {}),
    ...(normalized.confirmedAt ? { confirmedAt: normalized.confirmedAt } : {}),
  };

  const transaction = await prisma.paymentTransaction.upsert({
    where: {
      paymentReference: normalized.paymentReference,
    },
    create: {
      paymentReference: normalized.paymentReference,
      ...updateData,
    },
    update: updateData,
  });

  return {
    transaction,
    created: !existing,
    previousStatus: existing?.status || null,
  };
}

async function createPaymentAuditLog({ entityId, action, metadata }, tx = prisma) {
  await auditLogService.createAuditLog(
    {
      actorUserId: null,
      entityType: AUDIT_ENTITY_TYPES.PAYMENT_TRANSACTION,
      entityId,
      action,
      metadata,
    },
    tx,
  );
}

async function recordPaymentTransactionAudit({ transaction, created, previousStatus, source }) {
  await prisma.$transaction(async (tx) => {
    await createPaymentAuditLog({
      entityId: transaction.id,
      action: created ? AUDIT_ACTIONS.CREATE : AUDIT_ACTIONS.UPDATE,
      metadata: {
        source,
        paymentReference: transaction.paymentReference,
        gatewayName: transaction.gatewayName,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
      },
    }, tx);

    if (previousStatus !== transaction.status) {
      await createPaymentAuditLog({
        entityId: transaction.id,
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        metadata: {
          source,
          paymentReference: transaction.paymentReference,
          previousStatus,
          newStatus: transaction.status,
        },
      }, tx);
    }
  });
}

async function recordReserveSyncAudit({ transaction, reserveSync, source }) {
  await prisma.$transaction(async (tx) => {
    await createPaymentAuditLog({
      entityId: transaction.id,
      action: AUDIT_ACTIONS.SYNC_RESERVE,
      metadata: {
        source,
        paymentReference: transaction.paymentReference,
        paymentStatus: transaction.status,
        reserveLedgerId: reserveSync.reserveLedger?.id || null,
        reserveCreated: reserveSync.created,
        reserveSkipped: reserveSync.skipped,
        reason: reserveSync.reason || null,
      },
    }, tx);
  });
}

async function getPaymentTransactionByReference(paymentReference) {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: {
      paymentReference,
    },
  });

  if (!transaction) {
    throw new ApiError(404, 'Payment transaction not found');
  }

  const reserveLedger = await reserveService.findReserveByPaymentReference(paymentReference);

  return {
    ...transaction,
    reserveLedger,
  };
}

async function ingestPaymentCallback(payload, headers = {}) {
  const secretHeaderName = env.PAYMENT_GATEWAY_WEBHOOK_SECRET_HEADER.toLowerCase();

  if (env.PAYMENT_GATEWAY_WEBHOOK_SECRET) {
    const presentedSecret = headers?.[secretHeaderName];

    if (!presentedSecret || String(presentedSecret) !== env.PAYMENT_GATEWAY_WEBHOOK_SECRET) {
      throw new ApiError(403, 'Invalid payment gateway webhook secret');
    }
  }

  const normalized = normalizePaymentPayload(payload);
  if (!normalized) {
    throw new ApiError(400, 'Payment callback must include payment reference, amount, and status');
  }

  const { transaction, created, previousStatus } = await upsertPaymentTransaction({
    normalized: {
      ...normalized,
      gatewayName: env.PAYMENT_GATEWAY_NAME,
    },
    rawCallbackPayload: payload,
    rawCallbackHeaders: toJsonSafeObject(headers),
    parsedPayload: normalized,
  });

  await recordPaymentTransactionAudit({
    transaction,
    created,
    previousStatus,
    source: 'PAYMENT_CALLBACK',
  });

  const reserveSync = await reserveService.syncReserveFromPaymentTransaction(transaction);
  await recordReserveSyncAudit({
    transaction,
    reserveSync,
    source: 'PAYMENT_CALLBACK',
  });

  return {
    transaction,
    reserveSync,
    accepted: true,
  };
}

async function verifyPaymentStatus(paymentReference) {
  const url = buildStatusVerificationUrl(paymentReference);
  const headers = {
    Accept: 'application/json, text/plain, */*',
  };

  if (env.PAYMENT_GATEWAY_API_KEY) {
    headers[env.PAYMENT_GATEWAY_API_KEY_HEADER] = env.PAYMENT_GATEWAY_API_KEY;
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers,
    });

    const responseText = await response.text();
    let parsedResponse;

    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      throw new ApiError(502, 'Payment gateway status response was not valid JSON');
    }

    const normalized = normalizePaymentPayload(parsedResponse, paymentReference);
    if (!normalized) {
      throw new ApiError(502, 'Payment gateway status response did not include payment reference, amount, and status');
    }

    const { transaction, created, previousStatus } = await upsertPaymentTransaction({
      normalized: {
        ...normalized,
        gatewayName: env.PAYMENT_GATEWAY_NAME,
      },
      rawStatusResponse: {
        status: response.status,
        statusText: response.statusText,
        body: parsedResponse,
      },
      parsedStatus: normalized,
      markVerified: true,
    });

    await recordPaymentTransactionAudit({
      transaction,
      created,
      previousStatus,
      source: 'PAYMENT_STATUS_VERIFY',
    });

    const reserveSync = await reserveService.syncReserveFromPaymentTransaction(transaction);
    await recordReserveSyncAudit({
      transaction,
      reserveSync,
      source: 'PAYMENT_STATUS_VERIFY',
    });

    return {
      transaction,
      reserveSync,
      verification: {
        httpStatus: response.status,
        url,
        payload: parsedResponse,
      },
    };
  } catch (error) {
    logger.error(`Payment status verification failed for ${paymentReference}`, error);
    throw error;
  }
}

async function listPaymentReconciliationCandidates({ limit = env.PAYMENT_RECONCILE_BATCH_LIMIT, includeTerminalFailures = false } = {}) {
  const requestedLimit = Math.min(Math.max(Number(limit) || env.PAYMENT_RECONCILE_BATCH_LIMIT, 1), 100);
  const transactions = await prisma.paymentTransaction.findMany({
    orderBy: [
      { lastVerifiedAt: 'asc' },
      { updatedAt: 'asc' },
      { createdAt: 'asc' },
    ],
    take: requestedLimit * 5,
  });

  const candidates = [];
  for (const transaction of transactions) {
    const reserveLedger = await reserveService.findReserveByPaymentReference(transaction.paymentReference);
    if (shouldReconcilePaymentTransaction(transaction, reserveLedger, includeTerminalFailures)) {
      candidates.push({
        transaction,
        reserveLedger,
      });
    }

    if (candidates.length >= requestedLimit) {
      break;
    }
  }

  return candidates;
}

async function reconcilePendingPayments(options = {}) {
  const candidates = await listPaymentReconciliationCandidates(options);
  const results = [];

  for (const candidate of candidates) {
    const paymentReference = candidate.transaction.paymentReference;

    try {
      const reconciliation = await verifyPaymentStatus(paymentReference);
      results.push({
        paymentReference,
        ok: true,
        status: reconciliation.transaction.status,
        reserveLedgerId: reconciliation.reserveSync.reserveLedger?.id || candidate.reserveLedger?.id || null,
        reserveCreated: reconciliation.reserveSync.created,
        reserveSkipped: reconciliation.reserveSync.skipped,
        reason: reconciliation.reserveSync.reason || null,
      });
    } catch (error) {
      results.push({
        paymentReference,
        ok: false,
        status: candidate.transaction.status,
        reserveLedgerId: candidate.reserveLedger?.id || null,
        error: error.message,
      });
    }
  }

  return {
    total: candidates.length,
    succeeded: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };
}

module.exports = {
  ingestPaymentCallback,
  getPaymentTransactionByReference,
  reconcilePendingPayments,
  verifyPaymentStatus,
};
