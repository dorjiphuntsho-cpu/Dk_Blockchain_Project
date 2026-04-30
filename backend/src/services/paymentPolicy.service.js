const DEFAULT_GATEWAY_NAME = 'DK_PAYMENT_GATEWAY';

const SUCCESS_STATUSES = new Set(['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'CONFIRMED', 'PAID']);
const FAILURE_STATUSES = new Set(['FAILED', 'FAILURE', 'REJECTED', 'DECLINED', 'CANCELLED', 'EXPIRED']);

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

  return String(value).trim().replace(/\s+/g, '_').replace(/-/g, '_').toUpperCase();
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

function normalizePaymentPayload(payload, fallbackReference = null, gatewayName = DEFAULT_GATEWAY_NAME) {
  const source = {
    ...(payload && typeof payload === 'object' ? payload : {}),
    ...(payload?.data && typeof payload.data === 'object' ? payload.data : {}),
    ...(payload?.response_data && typeof payload.response_data === 'object' ? payload.response_data : {}),
  };

  const paymentReference =
    getFirstNonEmptyValue(source, [
      'paymentReference',
      'payment_reference',
      'transactionReference',
      'transaction_reference',
    ]) || fallbackReference;

  const amount = normalizeAmount(
    source.amount ?? source.transactionAmount ?? source.transaction_amount,
  );

  const status = normalizeGatewayStatus(
    getFirstNonEmptyValue(source, [
      'status',
      'paymentStatus',
      'payment_status',
      'transactionStatus',
      'transaction_status',
    ]),
  );

  if (!paymentReference || !amount || !status) {
    return null;
  }

  const confirmedAt =
    parseGatewayDate(
      getFirstNonEmptyValue(source, [
        'confirmedAt',
        'confirmed_at',
        'paymentTime',
        'payment_time',
        'transactionTime',
        'transaction_time',
      ]),
    ) || (isSuccessfulPaymentStatus(status) ? new Date() : null);

  return {
    gatewayName,
    paymentReference,
    gatewayTransactionId: getFirstNonEmptyValue(source, [
      'gatewayTransactionId',
      'gateway_transaction_id',
      'transactionId',
      'transaction_id',
    ]),
    customerReference: getFirstNonEmptyValue(source, [
      'customerReference',
      'customer_reference',
    ]),
    payerName: getFirstNonEmptyValue(source, ['payerName', 'payer_name']),
    payerAccount: getFirstNonEmptyValue(source, ['payerAccount', 'payer_account']),
    amount,
    currency: getFirstNonEmptyValue(source, ['currency', 'currencyCode', 'currency_code']) || 'BTN',
    status,
    statusMessage: getFirstNonEmptyValue(source, [
      'statusMessage',
      'status_message',
      'message',
      'description',
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
