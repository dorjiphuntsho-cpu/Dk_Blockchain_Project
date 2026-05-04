const DEFAULT_GATEWAY_NAME = 'DK_PAYMENT_GATEWAY';

const SUCCESS_STATUSES = new Set(['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'CONFIRMED', 'PAID']);
const FAILURE_STATUSES = new Set(['FAILED', 'FAILURE', 'REJECTED', 'DECLINED', 'CANCELLED', 'EXPIRED']);

function getFirstNonEmptyValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value === undefined || value === null) {
      continue;
    }

     if (typeof value === 'object') {
      continue;
    }

    if (typeof value === 'boolean') {
      return String(value);
    }

    const normalized = String(value).trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function parseGatewayDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function normalizeGatewayStatus(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().replace(/\s+/g, '_').replace(/-/g, '_').toUpperCase();

  if (normalized === '0' || normalized === 'SUCCESS' || normalized === 'SUCCESSFULLY_COMPLETED') {
    return 'COMPLETED';
  }

  return normalized;
}

function normalizeAmount(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }

  return normalized.toFixed(10);
}

function isSuccessfulPaymentStatus(status) {
  return SUCCESS_STATUSES.has(String(status || '').toUpperCase());
}

function isTerminalFailedPaymentStatus(status) {
  return FAILURE_STATUSES.has(String(status || '').toUpperCase());
}

function buildNormalizationCandidates(payload) {
  const candidates = [];
  const queue = [payload];
  const seen = new Set();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== 'object') {
      continue;
    }

    if (seen.has(current)) {
      continue;
    }

    seen.add(current);
    candidates.push(current);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    queue.push(current.data);
    queue.push(current.response_data);
    queue.push(current.meta_info);
    queue.push(current.result);
    queue.push(current.transaction);
    queue.push(current.payment);

    if (Array.isArray(current.errors)) {
      queue.push(...current.errors);
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return candidates;
}

function pickFirstValue(sources, keys) {
  for (const source of sources) {
    const value = getFirstNonEmptyValue(source, keys);
    if (value) {
      return value;
    }
  }

  return null;
}

function normalizePaymentPayload(payload, fallbackReference = null, gatewayName = DEFAULT_GATEWAY_NAME, options = {}) {
  const sources = buildNormalizationCandidates(payload);

  const paymentReference =
    pickFirstValue(sources, [
      'paymentReference',
      'payment_reference',
      'transactionReference',
      'transaction_reference',
      'reference',
      'reference_number',
    ]) || fallbackReference;

  const rawAmount =
    pickFirstValue(sources, ['amount', 'transactionAmount', 'transaction_amount'])
    || options.fallbackAmount
    || null;
  const amount = normalizeAmount(rawAmount);

  const status = normalizeGatewayStatus(
    pickFirstValue(sources, [
      'status',
      'status_desc',
      'paymentStatus',
      'payment_status',
      'transactionStatus',
      'transaction_status',
      'txn_status',
      'response_status',
      'payment_state',
      'state',
    ]),
  );

  if (!paymentReference || !amount || !status) {
    return null;
  }

  const confirmedAt =
    parseGatewayDate(
      pickFirstValue(sources, [
        'confirmedAt',
        'confirmed_at',
        'paymentTime',
        'payment_time',
        'transactionTime',
        'transaction_time',
        'transaction_datetime',
      ]),
    ) || (isSuccessfulPaymentStatus(status) ? new Date() : null);

  return {
    gatewayName,
    paymentReference,
    gatewayTransactionId: pickFirstValue(sources, [
      'txn_status_id',
      'gatewayTransactionId',
      'gateway_transaction_id',
      'transactionId',
      'transaction_id',
      'txn_id',
      'srn',
    ]),
    customerReference: pickFirstValue(sources, [
      'customerReference',
      'customer_reference',
    ]),
    payerName: pickFirstValue(sources, ['payerName', 'payer_name', 'source_account_name']),
    payerAccount: pickFirstValue(sources, ['payerAccount', 'payer_account', 'source_account_number']),
    amount,
    currency: pickFirstValue(sources, ['currency', 'currencyCode', 'currency_code']) || options.fallbackCurrency || 'BTN',
    status,
    statusMessage: pickFirstValue(sources, [
      'statusMessage',
      'status_message',
      'message',
      'description',
      'response_detail',
    ]),
    confirmedAt,
  };
}

function shouldReconcilePaymentTransaction(transaction, reserveLedger, includeTerminalFailures = false) {
  const successful = isSuccessfulPaymentStatus(transaction?.status);
  const terminalFailure = isTerminalFailedPaymentStatus(transaction?.status);

  if (successful && !reserveLedger) {
    return true;
  }

  if (!successful && (!terminalFailure || includeTerminalFailures)) {
    return true;
  }

  return false;
}

module.exports = {
  DEFAULT_GATEWAY_NAME,
  normalizeGatewayStatus,
  normalizePaymentPayload,
  isSuccessfulPaymentStatus,
  isTerminalFailedPaymentStatus,
  shouldReconcilePaymentTransaction,
};
