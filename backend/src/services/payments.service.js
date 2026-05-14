const prisma = require('../config/prisma');
const env = require('../config/env');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const cbsService = require('./cbs.service');
const bipsService = require('./bips.service');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../utils/enums');
const auditLogService = require('./auditLog.service');
const reserveService = require('./reserve.service');
const solanaService = require('./solana.service');
const { normalizeLinkedBankAccounts } = require('../models/user.model');
const { assessBipsReconciliationResult } = require('./settlementPolicy.service');
const { resolveBipsError, isBipsRecordNotFound } = require('../utils/helpers');
const {
  normalizePaymentPayload,
  isSuccessfulPaymentStatus,
  shouldReconcilePaymentTransaction,
} = require('./paymentPolicy.service');

const PAYMENT_GATEWAY_TOKEN_CACHE_BUFFER_MS = 30 * 1000;
const PAYMENT_GATEWAY_TOKEN_RETRY_DELAY_MS = 500;
const PAYMENT_GATEWAY_TOKEN_MAX_ATTEMPTS = 2;
const paymentGatewayTokenCache = new Map();
const CUSTOMER_BTN_PAYMENT_PREFIXES = {
  BUY: 'BTNBUY',
  SELL: 'BTNSELL',
  TRANSFER: 'BTNTRANSFER',
};
const BIPS_GATEWAY_NAME = 'BIPS';

function getLinkedBankAccounts(user) {
  return normalizeLinkedBankAccounts(user);
}

function findLinkedBankAccount(user, accountNumber) {
  const normalizedAccountNumber = String(accountNumber || '').trim();
  return getLinkedBankAccounts(user).find((account) => account.accountNumber === normalizedAccountNumber) || null;
}

function extractBipsResponseCode(payload) {
  return getFirstNonEmptyValue(payload, ['response_code', 'responseCode'])
    || getFirstNonEmptyValue(payload?.parsedResponse, ['responseCode'])
    || getFirstNonEmptyValue(payload?.parsedResponse?.embeddedResponse, ['ResponseCode'])
    || null;
}

function extractBipsResponseMessage(payload) {
  return getFirstNonEmptyValue(payload, ['response_description', 'response_message', 'message'])
    || getFirstNonEmptyValue(payload?.parsedResponse, ['responseText', 'responseMessage'])
    || getFirstNonEmptyValue(payload?.parsedResponse?.embeddedResponse, ['ResponseDesc', 'ResponseMessage'])
    || null;
}

function extractBipsReferenceNumber(payload) {
  return getFirstNonEmptyValue(payload, ['reference_number', 'referenceNumber'])
    || getFirstNonEmptyValue(payload?.response_data, ['reference_number', 'referenceNumber'])
    || getFirstNonEmptyValue(payload?.parsedResponse?.embeddedResponse, ['RetrievalReferenceNumber'])
    || null;
}

function extractBipsTransactionId(payload) {
  return getFirstNonEmptyValue(payload, ['rr_number', 'msgRefNo', 'transaction_id', 'transactionId'])
    || getFirstNonEmptyValue(payload?.response_data, ['rr_number', 'msgRefNo', 'transaction_id', 'transactionId'])
    || getFirstNonEmptyValue(payload?.parsedResponse, ['msgRefNo', 'transactionId'])
    || null;
}

function extractBipsBeneficiaryAccountName(payload) {
  return getFirstNonEmptyValue(payload, ['beneficiary_account_name', 'beneficiaryAccountName'])
    || getFirstNonEmptyValue(payload?.response_data, ['beneficiary_account_name', 'beneficiaryAccountName'])
    || getFirstNonEmptyValue(payload?.parsedResponse, ['beneficiaryAccountName'])
    || null;
}

function normalizeBipsPaymentStatus(payload, fallbackStatus = 'INITIATED') {
  const responseCode = extractBipsResponseCode(payload);
  if (responseCode === '0000') {
    return 'COMPLETED';
  }

  if (isBipsRecordNotFound(responseCode)) {
    return fallbackStatus;
  }

  const resolved = responseCode ? resolveBipsError(responseCode) : null;
  if (resolved && resolved.httpStatus >= 400) {
    return 'FAILED';
  }

  const assessment = assessBipsReconciliationResult(
    payload?.parsedResponse ? payload : { parsedResponse: payload || {} },
    'BIPS_STATUS_VERIFY',
  );

  if (assessment.outcome === 'SUCCESS') {
    return 'COMPLETED';
  }

  if (assessment.outcome === 'FAILED') {
    return 'FAILED';
  }

  return fallbackStatus;
}

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

function getLinkedBankAccountNumbers(user) {
  const normalized = [];
  const seen = new Set();

  for (const value of [user.linkedBankAccountNumber, ...(user.linkedBankAccountNumbers || [])]) {
    const accountNumber = String(value || '').trim();
    if (!accountNumber || seen.has(accountNumber)) {
      continue;
    }
    seen.add(accountNumber);
    normalized.push(accountNumber);
  }

  return normalized;
}

function buildResponsePreview(responseText, maxLength = 300) {
  const normalized = String(responseText || '').replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return '[empty response body]';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCustomerPaymentReference(prefix = CUSTOMER_BTN_PAYMENT_PREFIXES.BUY) {
  return `${prefix}${Date.now()}${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function buildCustomerBuyReference(userId) {
  return `BTN_BUY:${userId}:${generateGatewayRequestId()}`;
}

function buildCustomerSellReference(userId) {
  return `BTN_SELL:${userId}:${generateGatewayRequestId()}`;
}

function buildCustomerTransferReference(userId) {
  return `BTN_TRANSFER:${userId}:${generateGatewayRequestId()}`;
}

function normalizePositiveAmount(value, fieldName) {
  const normalized = Number(String(value || '').trim());

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new ApiError(400, `${fieldName} must be a valid positive number`);
  }

  return normalized.toFixed(10);
}

function convertDisplayAmountToRawAmount(value, decimals = 0) {
  const normalized = String(value || '').trim();
  const normalizedDecimals = Number.isInteger(decimals) && decimals >= 0 ? decimals : 0;
  const [wholePart, fractionPart = ''] = normalized.split('.');
  const paddedFraction = fractionPart.padEnd(normalizedDecimals, '0');
  return `${wholePart}${paddedFraction.slice(0, normalizedDecimals)}`.replace(/^0+(?=\d)/, '') || '0';
}

function calculateFiatAmountFromTokenAmount(tokenAmount) {
  const referencePrice = Number(env.BTN_REFERENCE_PRICE);

  if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
    throw new ApiError(500, 'BTN reference price is not configured correctly');
  }

  return (Number(tokenAmount) * referencePrice).toFixed(10);
}

function normalizeTokenLabel(value) {
  return String(value || '').trim().toUpperCase();
}

function selectCustomerPortalMint(tokens) {
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeJsonObjects(existingValue, nextValue) {
  if (!isPlainObject(existingValue)) {
    return nextValue;
  }

  if (!isPlainObject(nextValue)) {
    return nextValue;
  }

  return {
    ...existingValue,
    ...nextValue,
  };
}

function extractGatewayInquiryId(payload) {
  return getFirstNonEmptyValue(payload, ['inquiry_id'])
    || getFirstNonEmptyValue(payload?.data, ['inquiry_id'])
    || getFirstNonEmptyValue(payload?.response_data, ['inquiry_id'])
    || getFirstNonEmptyValue(payload?.response_data?.data, ['inquiry_id'])
    || getFirstNonEmptyValue(payload?.response_data?.meta_info, ['inquiry_id'])
    || getFirstNonEmptyValue(payload?.meta_info, ['inquiry_id'])
    || null;
}

async function getCustomerBuyContext(userId) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      wallets: {
        where: {
          isActive: true,
        },
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'asc' },
        ],
      },
      customerBankAccounts: {
        where: {
          isActive: true,
        },
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'asc' },
        ],
        include: {
          bank: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    throw new ApiError(404, 'Customer not found');
  }

  const linkedBankAccountNumbers = getLinkedBankAccountNumbers(user);

  if (linkedBankAccountNumbers.length === 0) {
    throw new ApiError(400, 'Customer does not have a linked bank account');
  }

  const primaryWallet = user.wallets[0] || null;
  if (!primaryWallet) {
    throw new ApiError(400, 'Customer does not have an active wallet linked');
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
    orderBy: [
      { createdAt: 'asc' },
    ],
  });

  if (!issuerBank) {
    throw new ApiError(404, 'Issuer bank is not configured');
  }

  const reserveAccount = issuerBank.accounts.find((account) => account.accountType === 'RESERVE') || null;
  if (!reserveAccount) {
    throw new ApiError(404, `Reserve account is not configured for issuer bank ${issuerBank.name}`);
  }

  return {
    user,
    linkedBankAccountNumbers,
    primaryWallet,
    issuerBank,
    reserveAccount,
  };
}

async function getCustomerSellContext(userId) {
  const { user, primaryWallet, issuerBank, reserveAccount } = await getCustomerBuyContext(userId);
  const managedTokens = await prisma.managedToken.findMany({
    orderBy: [
      { createdAt: 'desc' },
    ],
  });
  const managedToken = selectCustomerPortalMint(managedTokens);

  if (!managedToken?.mintAddress) {
    throw new ApiError(500, 'No BTN managed token is configured for customer sell requests');
  }

  const walletBalances = await solanaService.getWalletTokenBalances(primaryWallet.walletAddress);
  const walletBtnBalance = walletBalances.find((item) => item.mintAddress === managedToken.mintAddress) || null;

  return {
    user,
    primaryWallet,
    issuerBank,
    reserveAccount,
    managedToken,
    walletBtnBalance,
  };
}

async function getCustomerTransferContext(userId, recipientCid) {
  const senderContext = await getCustomerSellContext(userId);
  const recipientUser = await prisma.user.findUnique({
    where: {
      cid: String(recipientCid || '').trim(),
    },
    include: {
      wallets: {
        where: {
          isActive: true,
        },
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'asc' },
        ],
      },
    },
  });

  if (!recipientUser || !recipientUser.isActive) {
    throw new ApiError(404, 'Recipient customer not found');
  }

  if (recipientUser.id === senderContext.user.id) {
    throw new ApiError(400, 'Recipient customer must be different from the sender');
  }

  return {
    ...senderContext,
    recipientUser,
    recipientPrimaryWallet: recipientUser.wallets[0] || null,
  };
}

function getGatewayTokenCacheKey({ sourceApp, scopes }) {
  return `${sourceApp}::${scopes}`;
}

function getCachedGatewayAuthorizationToken({ sourceApp, scopes }) {
  const cacheKey = getGatewayTokenCacheKey({ sourceApp, scopes });
  const cachedEntry = paymentGatewayTokenCache.get(cacheKey);

  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now() + PAYMENT_GATEWAY_TOKEN_CACHE_BUFFER_MS) {
    paymentGatewayTokenCache.delete(cacheKey);
    return null;
  }

  return cachedEntry;
}

function cacheGatewayAuthorizationToken({
  sourceApp,
  scopes,
  accessToken,
  payload,
  httpStatus,
  requestId,
}) {
  if (!accessToken) {
    return;
  }

  const expiresInSeconds = Number(payload?.response_data?.expires_in ?? payload?.response_data?.expiresIn);
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    return;
  }

  const expiresAt = Date.now() + (expiresInSeconds * 1000);
  const cacheKey = getGatewayTokenCacheKey({ sourceApp, scopes });

  paymentGatewayTokenCache.set(cacheKey, {
    accessToken,
    expiresAt,
    httpStatus,
    payload,
    requestId,
    scopes,
    sourceApp,
  });
}

function shouldRetryGatewayTokenResponse({ responseStatus, responseText, contentType }) {
  if ([408, 429, 500, 502, 503, 504].includes(responseStatus)) {
    return true;
  }

  const normalizedContentType = String(contentType || '').toLowerCase();
  const normalizedBody = String(responseText || '').trim().toLowerCase();

  if (!normalizedBody) {
    return true;
  }

  if (normalizedContentType.includes('text/html')) {
    return true;
  }

  return normalizedBody.startsWith('<!doctype html')
    || normalizedBody.startsWith('<html')
    || normalizedBody.includes('<body');
}

function shouldRetryGatewayTokenError(error) {
  if (error instanceof ApiError) {
    return [408, 429, 500, 502, 503, 504].includes(error.statusCode);
  }

  return true;
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

function buildGatewayUrl(path) {
  if (!env.PAYMENT_GATEWAY_BASE_URL) {
    throw new ApiError(500, 'Payment gateway is not configured');
  }

  const baseUrl = String(env.PAYMENT_GATEWAY_BASE_URL).replace(/\/+$/, '');
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  return `${baseUrl}/${normalizedPath}`;
}

function buildStatusVerificationUrl(paymentReference) {
  const url = new URL(buildGatewayUrl(env.PAYMENT_GATEWAY_STATUS_PATH));
  url.searchParams.set(env.PAYMENT_GATEWAY_STATUS_REFERENCE_QUERY_PARAM, paymentReference);
  return url.toString();
}

function buildGatewayStatusVerificationPayload(paymentTransaction, mode = 'SUBSEQUENT_DAYS') {
  const requestId = generateGatewayRequestId();
  const requestPayload = paymentTransaction?.parsedPayload?.requestPayload || {};
  const gatewayInitiationResponse = paymentTransaction?.parsedPayload?.gatewayInitiationResponse || {};
  const transactionId =
    paymentTransaction?.gatewayTransactionId
    || getFirstNonEmptyValue(gatewayInitiationResponse, [
      'txn_status_id',
      'transaction_id',
      'gateway_transaction_id',
      'txn_id',
      'transactionId',
      'gatewayTransactionId',
      'srn',
    ])
    || getFirstNonEmptyValue(gatewayInitiationResponse?.response_data, [
      'txn_status_id',
      'transaction_id',
      'gateway_transaction_id',
      'txn_id',
      'transactionId',
      'gatewayTransactionId',
      'srn',
    ])
    || requestPayload.request_id
    || getFirstNonEmptyValue(gatewayInitiationResponse, [
      'transaction_id',
      'gateway_transaction_id',
      'txn_id',
      'transactionId',
      'gatewayTransactionId',
    ])
    || getFirstNonEmptyValue(gatewayInitiationResponse?.response_data, [
      'transaction_id',
      'gateway_transaction_id',
      'txn_id',
      'transactionId',
      'gatewayTransactionId',
    ])
    || null;
  const beneficiaryAccountNumber =
    paymentTransaction?.parsedPayload?.statusBeneficiaryAccountNumber
    || paymentTransaction?.parsedPayload?.reserveAccountNumber
    || requestPayload.bene_account_number
    || requestPayload.beneficiary_account_number
    || null;
  const transactionDate =
    formatGatewayBusinessDate(requestPayload.transaction_datetime)
    || formatGatewayBusinessDate(paymentTransaction?.confirmedAt)
    || formatGatewayBusinessDate(paymentTransaction?.createdAt)
    || formatGatewayBusinessDate();

  return {
    request_id: requestId,
    source_app: env.PAYMENT_GATEWAY_SOURCE_APP,
    transaction_id: transactionId,
    bene_account_number: beneficiaryAccountNumber,
    ...(mode === 'SUBSEQUENT_DAYS' ? { transaction_date: transactionDate } : {}),
  };
}

function buildGatewayApiKeyHeaders() {
  if (!env.PAYMENT_GATEWAY_API_KEY) {
    return {};
  }

  return {
    [env.PAYMENT_GATEWAY_API_KEY_HEADER]: env.PAYMENT_GATEWAY_API_KEY,
  };
}

function generateGatewayRequestId() {
  return randomUUID().replace(/-/g, '');
}

function assertGatewayTokenConfig() {
  const missing = [
    ['PAYMENT_GATEWAY_BASE_URL', env.PAYMENT_GATEWAY_BASE_URL],
    ['PAYMENT_GATEWAY_USERNAME', env.PAYMENT_GATEWAY_USERNAME],
    ['PAYMENT_GATEWAY_PASSWORD', env.PAYMENT_GATEWAY_PASSWORD],
    ['PAYMENT_GATEWAY_CLIENT_ID', env.PAYMENT_GATEWAY_CLIENT_ID],
    ['PAYMENT_GATEWAY_CLIENT_SECRET', env.PAYMENT_GATEWAY_CLIENT_SECRET],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new ApiError(500, `Payment gateway token configuration is incomplete: ${missing.join(', ')}`);
  }
}

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader) {
    return null;
  }

  const normalized = String(authorizationHeader).trim();
  if (!normalized.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return normalized.slice(7).trim() || null;
}

function formatGatewayTimestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function formatGatewayBusinessDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeys(item));
  }

  if (!value || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((accumulator, key) => {
      accumulator[key] = sortObjectKeys(value[key]);
      return accumulator;
    }, {});
}

function createCanonicalJsonString(payload) {
  return JSON.stringify(sortObjectKeys(payload));
}

function normalizeGatewayPayloadForPath(path, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const normalized = { ...payload };

  if (path === env.PAYMENT_GATEWAY_BENEFICIARY_INQUIRY_PATH) {
    const sourceAccountNumber = normalized.source_account_number || normalized.soure_account_number;
    if (sourceAccountNumber && !normalized.soure_account_number) {
      normalized.soure_account_number = sourceAccountNumber;
    }
  }

  return normalized;
}

function generateGatewaySignature({
  privateKeyPem,
  payload,
  sourceApp = env.PAYMENT_GATEWAY_SOURCE_APP,
  timestamp = formatGatewayTimestamp(),
  nonce = generateGatewayRequestId(),
}) {
  if (!privateKeyPem) {
    throw new ApiError(400, 'Gateway private key is required');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError(400, 'Gateway payload must be a JSON object');
  }

  const canonicalPayload = createCanonicalJsonString(payload);
  const bodyBase64 = Buffer.from(canonicalPayload, 'utf8').toString('base64');
  const signaturePayload = {
    data: bodyBase64,
    timestamp,
    nonce,
  };
  const signatureJwt = jwt.sign(signaturePayload, privateKeyPem, {
    algorithm: 'RS256',
    noTimestamp: true,
  });

  return {
    sourceApp,
    timestamp,
    nonce,
    canonicalPayload,
    bodyBase64,
    signaturePayload,
    signatureJwt,
    authorizationHeader: `DKSignature ${signatureJwt}`,
    headers: {
      'DK-Signature': `DKSignature ${signatureJwt}`,
      'DK-Timestamp': timestamp,
      'DK-Nonce': nonce,
      source_app: sourceApp,
    },
  };
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
    customerReference: normalized.customerReference ?? existing?.customerReference ?? null,
    payerName: normalized.payerName ?? existing?.payerName ?? null,
    payerAccount: normalized.payerAccount ?? existing?.payerAccount ?? null,
    amount: normalized.amount,
    currency: normalized.currency,
    status: normalized.status,
    statusMessage: normalized.statusMessage,
    ...(rawCallbackPayload !== undefined ? { rawCallbackPayload } : {}),
    ...(rawCallbackHeaders !== undefined ? { rawCallbackHeaders } : {}),
    ...(parsedPayload !== undefined ? { parsedPayload: mergeJsonObjects(existing?.parsedPayload, parsedPayload) } : {}),
    ...(rawStatusResponse !== undefined ? { rawStatusResponse } : {}),
    ...(parsedStatus !== undefined ? { parsedStatus: mergeJsonObjects(existing?.parsedStatus, parsedStatus) } : {}),
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

function isCustomerBuyTransaction(paymentTransaction) {
  return paymentTransaction?.parsedPayload?.initiatedBy === 'CUSTOMER_PORTAL'
    && String(paymentTransaction?.customerReference || '').startsWith('BTN_BUY:');
}

function isCustomerSellTransaction(paymentTransaction) {
  return paymentTransaction?.parsedPayload?.initiatedBy === 'CUSTOMER_PORTAL'
    && String(paymentTransaction?.customerReference || '').startsWith('BTN_SELL:');
}

function isCustomerTransferTransaction(paymentTransaction) {
  return paymentTransaction?.parsedPayload?.initiatedBy === 'CUSTOMER_PORTAL'
    && String(paymentTransaction?.customerReference || '').startsWith('BTN_TRANSFER:');
}

function isCustomerPortalTransaction(paymentTransaction) {
  return isCustomerBuyTransaction(paymentTransaction)
    || isCustomerSellTransaction(paymentTransaction)
    || isCustomerTransferTransaction(paymentTransaction);
}

async function updateCustomerPortalFulfillment(paymentReference, fulfillmentPatch = {}) {
  const existingTransaction = await prisma.paymentTransaction.findUnique({
    where: {
      paymentReference,
    },
  });

  if (!existingTransaction) {
    throw new ApiError(404, 'Payment transaction not found');
  }

  const existingFulfillment = isPlainObject(existingTransaction.parsedPayload?.fulfillment)
    ? existingTransaction.parsedPayload.fulfillment
    : {};
  const parsedPayload = mergeJsonObjects(existingTransaction.parsedPayload, {
    fulfillment: {
      ...existingFulfillment,
      ...fulfillmentPatch,
    },
  });

  return prisma.paymentTransaction.update({
    where: {
      paymentReference,
    },
    data: {
      parsedPayload,
      statusMessage: fulfillmentPatch.statusMessage || existingTransaction.statusMessage,
    },
  });
}

async function fulfillCustomerBuyTransaction(paymentTransaction) {
  if (!isCustomerBuyTransaction(paymentTransaction)) {
    return null;
  }

  if (!isSuccessfulPaymentStatus(paymentTransaction.status)) {
    return {
      delivered: false,
      pending: true,
      reason: 'Waiting for successful payment confirmation before token delivery.',
    };
  }

  const fulfillment = paymentTransaction.parsedPayload?.fulfillment || {};
  if (fulfillment.status === 'COMPLETED') {
    return {
      delivered: true,
      skipped: true,
      transfer: fulfillment.transfer || null,
    };
  }

  const destinationWalletAddress = paymentTransaction.parsedPayload?.sourceWalletAddress;
  const tokenAmount = paymentTransaction.parsedPayload?.tokenAmount;

  if (!destinationWalletAddress || !tokenAmount) {
    throw new ApiError(500, 'Customer buy payment record is missing treasury-transfer metadata');
  }

  const managedTokens = await prisma.managedToken.findMany({
    orderBy: [
      { createdAt: 'desc' },
    ],
  });
  const managedToken = selectCustomerPortalMint(managedTokens);

  if (!managedToken?.mintAddress) {
    throw new ApiError(500, 'No BTN managed token is configured for customer delivery');
  }

  const issuerBank = await prisma.bank.findFirst({
    where: {
      isIssuer: true,
      isActive: true,
    },
    orderBy: [
      { createdAt: 'asc' },
    ],
  });

  if (!issuerBank) {
    throw new ApiError(404, 'Issuer bank is not configured');
  }

  await updateCustomerPortalFulfillment(paymentTransaction.paymentReference, {
    status: 'DELIVERY_PENDING',
    updatedAt: new Date().toISOString(),
    statusMessage: 'Payment confirmed. BTN delivery from DK distribution account is in progress.',
  });

  try {
    const transferResult = await solanaService.transferFromBankDistributionToWallet({
      bankId: issuerBank.id,
      mintAddress: managedToken.mintAddress,
      amount: tokenAmount,
      destinationWalletAddress,
    });

    await updateCustomerPortalFulfillment(paymentTransaction.paymentReference, {
      status: 'COMPLETED',
      updatedAt: new Date().toISOString(),
      transfer: transferResult,
      statusMessage: 'Payment confirmed and BTN delivered to customer wallet.',
    });

    return {
      delivered: true,
      transfer: transferResult,
    };
  } catch (error) {
    await updateCustomerPortalFulfillment(paymentTransaction.paymentReference, {
      status: 'FAILED',
      updatedAt: new Date().toISOString(),
      error: error.message,
      statusMessage: `Payment confirmed but BTN delivery failed: ${error.message}`,
    });

    throw error;
  }
}

async function fulfillCustomerSellTransaction(paymentTransaction) {
  if (!isCustomerSellTransaction(paymentTransaction)) {
    return null;
  }

  if (!isSuccessfulPaymentStatus(paymentTransaction.status)) {
    return {
      delivered: false,
      pending: true,
      reason: 'Waiting for successful fiat payout confirmation before requesting BTN return.',
    };
  }

  const fulfillment = paymentTransaction.parsedPayload?.fulfillment || {};
  if (fulfillment.status === 'TOKEN_RETURN_REQUIRED' || fulfillment.status === 'COMPLETED') {
    return {
      delivered: false,
      skipped: true,
      transfer: fulfillment.transfer || null,
    };
  }

  const tokenAmount = paymentTransaction.parsedPayload?.tokenAmount;
  const sourceWalletAddress = paymentTransaction.parsedPayload?.sourceWalletAddress;
  const distributionWalletAddress = paymentTransaction.parsedPayload?.distributionWalletAddress;
  const distributionTokenAccountAddress = paymentTransaction.parsedPayload?.distributionTokenAccountAddress;
  const mintAddress = paymentTransaction.parsedPayload?.mintAddress;

  if (!tokenAmount || !sourceWalletAddress || !distributionWalletAddress || !distributionTokenAccountAddress || !mintAddress) {
    throw new ApiError(500, 'Customer sell payment record is missing token-return metadata');
  }

  await updateCustomerPortalFulfillment(paymentTransaction.paymentReference, {
    status: 'TOKEN_RETURN_PENDING',
    updatedAt: new Date().toISOString(),
    statusMessage: 'Fiat payout confirmed. BTN return from the customer wallet is in progress.',
  });

  try {
    const transferResult = await solanaService.transferFromCustomerWalletToDistribution({
      bankId: paymentTransaction.parsedPayload?.issuerBankId,
      mintAddress,
      amount: tokenAmount,
      sourceWalletAddress,
    });

    await updateCustomerPortalFulfillment(paymentTransaction.paymentReference, {
      status: 'COMPLETED',
      updatedAt: new Date().toISOString(),
      transfer: transferResult,
      statusMessage: 'Fiat payout confirmed and BTN returned automatically to the DK distribution wallet.',
    });

    return {
      delivered: true,
      transfer: transferResult,
    };
  } catch (error) {
    await updateCustomerPortalFulfillment(paymentTransaction.paymentReference, {
      status: 'DELEGATION_REQUIRED',
      updatedAt: new Date().toISOString(),
      error: error.message,
      statusMessage: 'Fiat payout confirmed, but automatic BTN return is not enabled yet. Customer sell delegation is required.',
      transfer: {
        mode: 'CUSTOMER_WALLET_DELEGATION_REQUIRED',
        mintAddress,
        amount: tokenAmount,
        sourceWalletAddress,
        distributionWalletAddress,
        distributionTokenAccountAddress,
      },
    });

    return {
      delivered: false,
      pending: true,
      reason: 'Customer wallet delegation is required for automatic sell execution.',
    };
  }
}

async function fulfillCustomerTransferFiatFallback(paymentTransaction) {
  if (!isCustomerTransferTransaction(paymentTransaction)) {
    return null;
  }

  if (paymentTransaction.parsedPayload?.transferMode !== 'FIAT_FALLBACK') {
    return null;
  }

  if (!isSuccessfulPaymentStatus(paymentTransaction.status)) {
    return {
      delivered: false,
      pending: true,
      reason: 'Waiting for successful fiat payout confirmation before returning BTN to distribution.',
    };
  }

  const fulfillment = paymentTransaction.parsedPayload?.fulfillment || {};
  if (fulfillment.status === 'COMPLETED') {
    return {
      delivered: true,
      skipped: true,
      transfer: fulfillment.transfer || null,
    };
  }

  const tokenAmount = paymentTransaction.parsedPayload?.tokenAmount;
  const sourceWalletAddress = paymentTransaction.parsedPayload?.sourceWalletAddress;
  const mintAddress = paymentTransaction.parsedPayload?.mintAddress;
  const issuerBankId = paymentTransaction.parsedPayload?.issuerBankId;

  if (!tokenAmount || !sourceWalletAddress || !mintAddress || !issuerBankId) {
    throw new ApiError(500, 'Customer transfer payout record is missing token-return metadata');
  }

  await updateCustomerPortalFulfillment(paymentTransaction.paymentReference, {
    status: 'TOKEN_RETURN_PENDING',
    updatedAt: new Date().toISOString(),
    statusMessage: 'Fiat payout confirmed. BTN return from the sender wallet is in progress.',
  });

  try {
    const transferResult = await solanaService.transferFromCustomerWalletToDistribution({
      bankId: issuerBankId,
      mintAddress,
      amount: tokenAmount,
      sourceWalletAddress,
    });

    await updateCustomerPortalFulfillment(paymentTransaction.paymentReference, {
      status: 'COMPLETED',
      updatedAt: new Date().toISOString(),
      transfer: transferResult,
      statusMessage: 'Fiat payout confirmed and BTN returned automatically to the DK distribution wallet.',
    });

    return {
      delivered: true,
      transfer: transferResult,
    };
  } catch (error) {
    await updateCustomerPortalFulfillment(paymentTransaction.paymentReference, {
      status: 'DELEGATION_REQUIRED',
      updatedAt: new Date().toISOString(),
      error: error.message,
      statusMessage: 'Fiat payout confirmed, but automatic BTN return is not enabled yet for the sender wallet.',
    });

    return {
      delivered: false,
      pending: true,
      reason: 'Sender wallet delegation is required for automatic transfer payout execution.',
    };
  }
}

async function syncPaymentOutcome(transaction, source) {
  if (isCustomerBuyTransaction(transaction)) {
    const fulfillment = await fulfillCustomerBuyTransaction(transaction);

    return {
      reserveLedger: null,
      created: false,
      skipped: true,
      reason: fulfillment?.reason || null,
      fulfillment,
      source,
    };
  }

  if (isCustomerSellTransaction(transaction)) {
    const fulfillment = await fulfillCustomerSellTransaction(transaction);

    return {
      reserveLedger: null,
      created: false,
      skipped: true,
      reason: fulfillment?.reason || null,
      fulfillment,
      source,
    };
  }

  if (isCustomerTransferTransaction(transaction)) {
    const fulfillment = await fulfillCustomerTransferFiatFallback(transaction);

    return {
      reserveLedger: null,
      created: false,
      skipped: true,
      reason: fulfillment?.reason || null,
      fulfillment,
      source,
    };
  }

  const reserveSync = await reserveService.syncReserveFromPaymentTransaction(transaction);
  await recordReserveSyncAudit({
    transaction,
    reserveSync,
    source,
  });

  return reserveSync;
}

async function ingestPaymentCallback(payload, headers = {}) {
  logger.info('Payment gateway callback received', {
    headerKeys: Object.keys(headers || {}).sort(),
    payloadKeys: Object.keys(payload || {}).sort(),
  });

  const secretHeaderName = env.PAYMENT_GATEWAY_WEBHOOK_SECRET_HEADER.toLowerCase();

  if (env.PAYMENT_GATEWAY_WEBHOOK_SECRET) {
    const presentedSecret = headers?.[secretHeaderName];

    if (!presentedSecret || String(presentedSecret) !== env.PAYMENT_GATEWAY_WEBHOOK_SECRET) {
      throw new ApiError(403, 'Invalid payment gateway webhook secret');
    }
  }

  const normalized = normalizePaymentPayload(payload);
  if (!normalized) {
    logger.warn('Payment gateway callback normalization failed', {
      payloadKeys: Object.keys(payload || {}).sort(),
      responsePreview: buildResponsePreview(JSON.stringify(payload || {})),
    });
    throw new ApiError(400, 'Payment callback must include payment reference, amount, and status');
  }

  logger.info('Payment gateway callback normalized', {
    paymentReference: normalized.paymentReference,
    status: normalized.status,
    amount: normalized.amount,
    currency: normalized.currency,
  });

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

  const reserveSync = await syncPaymentOutcome(transaction, 'PAYMENT_CALLBACK');

  logger.info('Payment gateway callback processed', {
    paymentReference: transaction.paymentReference,
    status: transaction.status,
    fulfillmentStatus: transaction.parsedPayload?.fulfillment?.status || null,
    reserveCreated: reserveSync?.created || false,
    reserveSkipped: reserveSync?.skipped || false,
  });

  return {
    transaction,
    reserveSync,
    accepted: true,
  };
}

async function verifyPaymentStatus(paymentReference) {
  const existingTransaction = await prisma.paymentTransaction.findUnique({
    where: {
      paymentReference,
    },
  });

  if (!existingTransaction) {
    throw new ApiError(404, 'Payment transaction not found');
  }

  if (
    existingTransaction.gatewayName === BIPS_GATEWAY_NAME
    || existingTransaction.parsedPayload?.payoutRail === BIPS_GATEWAY_NAME
  ) {
    const bipsTransactionId =
      existingTransaction.gatewayTransactionId
      || existingTransaction.parsedPayload?.bipsTransactionId
      || existingTransaction.parsedPayload?.rrNumber
      || null;

    if (!bipsTransactionId) {
      const transaction = await prisma.paymentTransaction.update({
        where: {
          paymentReference,
        },
        data: {
          lastVerifiedAt: new Date(),
          statusMessage: existingTransaction.statusMessage || 'BIPS payout initiated. Final status is not available yet.',
        },
      });

      return {
        transaction,
        reserveSync: {
          reserveLedger: await reserveService.findReserveByPaymentReference(paymentReference),
          created: false,
          skipped: true,
          reason: 'BIPS status verification is pending because no transaction id is available yet.',
        },
        verification: {
          pending: true,
          mode: 'BIPS_STATUS_CHECK',
          responses: [],
        },
      };
    }

    const statusPayload = await bipsService.checkTransactionStatus(bipsTransactionId);
    const nextStatus = normalizeBipsPaymentStatus(statusPayload, existingTransaction.status || 'INITIATED');
    const responseCode = extractBipsResponseCode(statusPayload);
    const resolved = resolveBipsError(responseCode);
    const assessment = assessBipsReconciliationResult(
      statusPayload?.parsedResponse ? statusPayload : { parsedResponse: statusPayload || {} },
      'BIPS_STATUS_CHECK',
    );
    const statusMessage =
      extractBipsResponseMessage(statusPayload)
      || (isBipsRecordNotFound(responseCode) ? 'BIPS payout was initiated successfully. Final status is not available yet.' : null)
      || resolved.message
      || (nextStatus === 'COMPLETED'
        ? 'BIPS payout completed successfully.'
        : nextStatus === 'FAILED'
          ? 'BIPS payout failed and requires review.'
          : 'BIPS payout is still pending confirmation.');

    const { transaction, created, previousStatus } = await upsertPaymentTransaction({
      normalized: {
        gatewayName: existingTransaction.gatewayName || BIPS_GATEWAY_NAME,
        paymentReference: existingTransaction.paymentReference,
        gatewayTransactionId: bipsTransactionId,
        customerReference: existingTransaction.customerReference,
        payerName: existingTransaction.payerName,
        payerAccount: existingTransaction.payerAccount,
        amount: String(existingTransaction.amount),
        currency: existingTransaction.currency,
        status: nextStatus,
        statusMessage,
        confirmedAt: nextStatus === 'COMPLETED' ? new Date() : existingTransaction.confirmedAt,
      },
      rawStatusResponse: {
        mode: 'BIPS_STATUS_CHECK',
        payload: statusPayload,
      },
      parsedStatus: {
        bipsStatusVerification: {
          assessment,
          transactionId: bipsTransactionId,
          payload: statusPayload,
        },
      },
      markVerified: true,
    });

    await recordPaymentTransactionAudit({
      transaction,
      created,
      previousStatus,
      source: 'PAYMENT_STATUS_VERIFY',
    });

    const reserveSync = await syncPaymentOutcome(transaction, 'PAYMENT_STATUS_VERIFY');

    return {
      transaction,
      reserveSync,
      verification: {
        mode: 'BIPS_STATUS_CHECK',
        payload: statusPayload,
        responses: [
          {
            mode: 'BIPS_STATUS_CHECK',
            assessment,
            payload: statusPayload,
          },
        ],
      },
    };
  }

  const verificationAttempts = [
    {
      mode: 'CURRENT_DAY',
      execute: () => getCurrentPaymentStatus({
        payload: buildGatewayStatusVerificationPayload(existingTransaction, 'CURRENT_DAY'),
      }),
    },
    {
      mode: 'SUBSEQUENT_DAYS',
      execute: () => getHistoricalPaymentStatus({
        payload: buildGatewayStatusVerificationPayload(existingTransaction, 'SUBSEQUENT_DAYS'),
      }),
    },
  ];

  const verificationResponses = [];
  let lastError = null;

  try {
    for (const attempt of verificationAttempts) {
      try {
        const result = await attempt.execute();
        verificationResponses.push({
          mode: attempt.mode,
          httpStatus: result.httpStatus,
          payload: result.payload,
          requestPayload: result.requestPayload,
        });

        const normalized = normalizePaymentPayload(
          result.payload,
          paymentReference,
          env.PAYMENT_GATEWAY_NAME,
          {
            fallbackAmount: existingTransaction.amount,
            fallbackCurrency: existingTransaction.currency,
          },
        );

        if (!normalized) {
          logger.warn('Payment gateway status normalization failed for signed verification response', {
            paymentReference,
            mode: attempt.mode,
            httpStatus: result.httpStatus,
            responsePreview: buildResponsePreview(JSON.stringify(result.payload || {})),
          });
          continue;
        }

        const { transaction, created, previousStatus } = await upsertPaymentTransaction({
          normalized: {
            ...normalized,
            gatewayName: env.PAYMENT_GATEWAY_NAME,
          },
          rawStatusResponse: {
            mode: attempt.mode,
            responses: verificationResponses,
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

        const reserveSync = await syncPaymentOutcome(transaction, 'PAYMENT_STATUS_VERIFY');

        return {
          transaction,
          reserveSync,
          verification: {
            mode: attempt.mode,
            payload: result.payload,
            requestPayload: result.requestPayload,
            responses: verificationResponses,
          },
        };
      } catch (error) {
        lastError = error;
        verificationResponses.push({
          mode: attempt.mode,
          error: error.message,
          gatewayErrors: error.errors || [],
        });

        logger.warn('Payment gateway signed status verification attempt failed', {
          paymentReference,
          mode: attempt.mode,
          errorMessage: error.message,
        });
      }
    }

    const transaction = await prisma.paymentTransaction.update({
      where: {
        paymentReference,
      },
      data: {
        lastVerifiedAt: new Date(),
        rawStatusResponse: {
          responses: verificationResponses,
        },
        statusMessage: existingTransaction.statusMessage || 'Payment initiated. Gateway status not available yet.',
      },
    });

    if (lastError && verificationResponses.every((response) => response.error)) {
      throw lastError;
    }

    return {
      transaction,
      reserveSync: {
        reserveLedger: await reserveService.findReserveByPaymentReference(paymentReference),
        created: false,
        skipped: true,
        reason: 'Gateway status verification did not return a usable payment status yet.',
      },
      verification: {
        pending: true,
        requestPayload: buildGatewayStatusVerificationPayload(existingTransaction, 'SUBSEQUENT_DAYS'),
        responses: verificationResponses,
      },
    };
  } catch (error) {
    logger.error(`Payment status verification failed for ${paymentReference}`, error);
    throw error;
  }
}

async function fetchGatewayAuthorizationToken(options = {}) {
  assertGatewayTokenConfig();

  const requestId = options.requestId || generateGatewayRequestId();
  const sourceApp = options.sourceApp || env.PAYMENT_GATEWAY_SOURCE_APP;
  const scopes = options.scopes || env.PAYMENT_GATEWAY_TOKEN_SCOPES;
  const cachedToken = getCachedGatewayAuthorizationToken({ sourceApp, scopes });

  if (cachedToken) {
    logger.info('Payment gateway token cache hit', {
      sourceApp,
      scopes,
      expiresAt: new Date(cachedToken.expiresAt).toISOString(),
    });

    return {
      httpStatus: cachedToken.httpStatus,
      requestId: cachedToken.requestId,
      sourceApp,
      scopes,
      payload: cachedToken.payload,
      accessToken: cachedToken.accessToken,
      cached: true,
    };
  }

  const formBody = new URLSearchParams({
    username: env.PAYMENT_GATEWAY_USERNAME,
    password: env.PAYMENT_GATEWAY_PASSWORD,
    client_id: env.PAYMENT_GATEWAY_CLIENT_ID,
    client_secret: env.PAYMENT_GATEWAY_CLIENT_SECRET,
    grant_type: env.PAYMENT_GATEWAY_TOKEN_GRANT_TYPE,
    scopes,
    source_app: sourceApp,
    request_id: requestId,
  });

  const headers = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/x-www-form-urlencoded',
    ...buildGatewayApiKeyHeaders(),
  };

  const url = buildGatewayUrl(env.PAYMENT_GATEWAY_AUTH_TOKEN_PATH);

  logger.info('Payment gateway token request', {
    method: 'POST',
    url,
    sourceApp,
    scopes,
    requestId,
  });

  try {
    let lastError;

    for (let attempt = 1; attempt <= PAYMENT_GATEWAY_TOKEN_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers,
          body: formBody.toString(),
        });

        const responseText = await response.text();
        const contentType = response.headers.get('content-type');
        let parsedResponse;

        try {
          parsedResponse = JSON.parse(responseText);
        } catch (error) {
          logger.error('Payment gateway token response JSON parse failed', {
            url,
            httpStatus: response.status,
            contentType,
            requestId,
            sourceApp,
            scopes,
            attempt,
            responsePreview: buildResponsePreview(responseText),
            parseError: error.message,
          });

          if (attempt < PAYMENT_GATEWAY_TOKEN_MAX_ATTEMPTS && shouldRetryGatewayTokenResponse({
            responseStatus: response.status,
            responseText,
            contentType,
          })) {
            logger.warn('Retrying payment gateway token request after non-JSON response', {
              attempt,
              nextAttempt: attempt + 1,
              requestId,
              sourceApp,
              scopes,
            });
            await sleep(PAYMENT_GATEWAY_TOKEN_RETRY_DELAY_MS);
            continue;
          }

          throw new ApiError(502, 'Payment gateway token response was not valid JSON');
        }

        if (!response.ok) {
          const gatewayMessage =
            getFirstNonEmptyValue(parsedResponse, ['response_detail', 'response_description', 'response_message'])
            || `Gateway responded with HTTP ${response.status}`;
          const apiError = new ApiError(502, `Payment gateway token request failed: ${gatewayMessage}`);

          if (attempt < PAYMENT_GATEWAY_TOKEN_MAX_ATTEMPTS && shouldRetryGatewayTokenResponse({
            responseStatus: response.status,
            responseText,
            contentType,
          })) {
            logger.warn('Retrying payment gateway token request after transient gateway failure', {
              attempt,
              nextAttempt: attempt + 1,
              requestId,
              sourceApp,
              scopes,
              httpStatus: response.status,
            });
            await sleep(PAYMENT_GATEWAY_TOKEN_RETRY_DELAY_MS);
            continue;
          }

          throw apiError;
        }

        const accessToken = parsedResponse?.response_data?.access_token;

        cacheGatewayAuthorizationToken({
          sourceApp,
          scopes,
          accessToken,
          payload: parsedResponse,
          httpStatus: response.status,
          requestId,
        });

        return {
          httpStatus: response.status,
          requestId,
          sourceApp,
          scopes,
          payload: parsedResponse,
          accessToken,
          cached: false,
        };
      } catch (error) {
        lastError = error;

        if (attempt < PAYMENT_GATEWAY_TOKEN_MAX_ATTEMPTS && shouldRetryGatewayTokenError(error)) {
          logger.warn('Retrying payment gateway token request after transport or timeout failure', {
            attempt,
            nextAttempt: attempt + 1,
            requestId,
            sourceApp,
            scopes,
            errorMessage: error.message,
          });
          await sleep(PAYMENT_GATEWAY_TOKEN_RETRY_DELAY_MS);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  } catch (error) {
    logger.error('Payment gateway token request failed', error);
    throw error;
  }
}

async function fetchGatewaySigningKey(options = {}) {
  if (!env.PAYMENT_GATEWAY_BASE_URL) {
    throw new ApiError(500, 'Payment gateway is not configured');
  }

  const accessToken = options.accessToken || extractBearerToken(options.authorizationHeader);
  if (!accessToken) {
    throw new ApiError(400, 'Gateway access token is required');
  }

  const requestId = options.requestId || generateGatewayRequestId();
  const sourceApp = options.sourceApp || env.PAYMENT_GATEWAY_SOURCE_APP;
  const url = buildGatewayUrl(env.PAYMENT_GATEWAY_FETCH_KEY_PATH);
  const headers = {
    Accept: 'text/plain, application/json, text/plain; charset=utf-8',
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...buildGatewayApiKeyHeaders(),
  };
  const body = {
    request_id: requestId,
    source_app: sourceApp,
  };

  logger.info('Payment gateway sign key request', {
    method: 'POST',
    url,
    sourceApp,
    requestId,
  });

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        throw new ApiError(502, `Payment gateway sign key request failed with HTTP ${response.status}`);
      }

      const gatewayMessage =
        getFirstNonEmptyValue(parsedResponse, ['response_detail', 'response_description', 'response_message'])
        || `Gateway responded with HTTP ${response.status}`;
      throw new ApiError(502, `Payment gateway sign key request failed: ${gatewayMessage}`);
    }

    const trimmedResponse = String(responseText || '').trim();
    if (!trimmedResponse) {
      throw new ApiError(502, 'Payment gateway sign key response was empty');
    }

    if (trimmedResponse.startsWith('{')) {
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(trimmedResponse);
      } catch {
        throw new ApiError(502, 'Payment gateway sign key response was not valid text or JSON');
      }

      const gatewayMessage =
        getFirstNonEmptyValue(parsedResponse, ['response_detail', 'response_description', 'response_message'])
        || 'Payment gateway sign key request did not return a private key';
      throw new ApiError(502, `Payment gateway sign key request failed: ${gatewayMessage}`);
    }

    return {
      requestId,
      sourceApp,
      privateKeyPem: responseText,
    };
  } catch (error) {
    logger.error('Payment gateway sign key request failed', error);
    throw error;
  }
}

async function authorizeGatewayPullPayment(options = {}) {
  return performSignedGatewayRequest({
    ...options,
    path: env.PAYMENT_GATEWAY_ACCOUNT_AUTH_PATH,
    operationName: 'Payment gateway account authorization request',
  });
}

async function createGatewayDebitRequest(options = {}) {
  return performSignedGatewayRequest({
    ...options,
    path: env.PAYMENT_GATEWAY_DEBIT_REQUEST_PATH,
    operationName: 'Payment gateway debit request',
  });
}

async function inquireGatewayBeneficiaryAccount(options = {}) {
  return performSignedGatewayRequest({
    ...options,
    path: env.PAYMENT_GATEWAY_BENEFICIARY_INQUIRY_PATH,
    operationName: 'Payment gateway beneficiary inquiry',
  });
}

async function initiateGatewayIntraTransaction(options = {}) {
  return performSignedGatewayRequest({
    ...options,
    path: env.PAYMENT_GATEWAY_FUND_TRANSFER_PATH,
    operationName: 'Payment gateway intra transaction initiation',
  });
}

async function getGatewayTransactionStatusForToday(options = {}) {
  return performSignedGatewayRequest({
    ...options,
    path: env.PAYMENT_GATEWAY_TRANSACTION_STATUS_TODAY_PATH,
    operationName: 'Payment gateway current-day transaction status request',
  });
}

async function getGatewayTransactionStatusForHistory(options = {}) {
  return performSignedGatewayRequest({
    ...options,
    path: env.PAYMENT_GATEWAY_TRANSACTION_STATUS_HISTORY_PATH,
    operationName: 'Payment gateway subsequent-day transaction status request',
  });
}

async function performManagedSignedGatewayRequest(options = {}) {
  const tokenResult = await fetchGatewayAuthorizationToken({
    sourceApp: options.sourceApp,
  });
  const accessToken = tokenResult.accessToken || tokenResult?.payload?.response_data?.access_token;

  if (!accessToken) {
    throw new ApiError(502, 'Payment gateway token response did not include an access token');
  }

  const keyResult = await fetchGatewaySigningKey({
    accessToken,
    sourceApp: options.sourceApp,
  });

  return performSignedGatewayRequest({
    accessToken,
    privateKeyPem: keyResult.privateKeyPem,
    payload: options.payload,
    sourceApp: options.sourceApp,
    timestamp: options.timestamp,
    nonce: options.nonce,
    path: options.path,
    operationName: options.operationName,
  });
}

async function performSignedGatewayRequest(options = {}) {
  const accessToken = options.accessToken || extractBearerToken(options.authorizationHeader);
  if (!accessToken) {
    throw new ApiError(400, 'Gateway access token is required');
  }

  const gatewayPayload = normalizeGatewayPayloadForPath(options.path, options.payload);

  const signature = generateGatewaySignature({
    privateKeyPem: options.privateKeyPem,
    payload: gatewayPayload,
    sourceApp: options.sourceApp,
    timestamp: options.timestamp,
    nonce: options.nonce,
  });

  const url = buildGatewayUrl(options.path);
  const headers = {
    Accept: 'application/json, text/plain, */*',
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'DK-Signature': signature.authorizationHeader,
    'DK-Timestamp': signature.timestamp,
    'DK-Nonce': signature.nonce,
    source_app: signature.sourceApp,
    ...buildGatewayApiKeyHeaders(),
  };

  logger.info(options.operationName, {
    method: 'POST',
    url,
    sourceApp: signature.sourceApp,
    timestamp: signature.timestamp,
    nonce: signature.nonce,
  });

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(gatewayPayload),
    });

    const responseText = await response.text();
    let parsedResponse = null;

    if (responseText) {
      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        parsedResponse = null;
      }
    }

    if (!response.ok) {
      const gatewayMessage = parsedResponse
        ? getFirstNonEmptyValue(parsedResponse, ['response_detail', 'response_description', 'response_message'])
        : null;
      throw new ApiError(
        502,
        `${options.operationName} failed: ${gatewayMessage || `HTTP ${response.status}`}`,
        parsedResponse
          ? [
            {
              gatewayResponse: parsedResponse,
            },
          ]
          : [],
      );
    }

    return {
      httpStatus: response.status,
      payload: parsedResponse || responseText,
      requestPayload: gatewayPayload,
      signature: {
        timestamp: signature.timestamp,
        nonce: signature.nonce,
        sourceApp: signature.sourceApp,
      },
    };
  } catch (error) {
    logger.error(`${options.operationName} failed`, error);
    throw error;
  }
}

async function authorizePullPayment(options = {}) {
  return performManagedSignedGatewayRequest({
    ...options,
    path: env.PAYMENT_GATEWAY_ACCOUNT_AUTH_PATH,
    operationName: 'Payment gateway account authorization request',
  });
}

async function debitPullPayment(options = {}) {
  return performManagedSignedGatewayRequest({
    ...options,
    path: env.PAYMENT_GATEWAY_DEBIT_REQUEST_PATH,
    operationName: 'Payment gateway debit request',
  });
}

async function beneficiaryAccountInquiry(options = {}) {
  return performManagedSignedGatewayRequest({
    ...options,
    path: env.PAYMENT_GATEWAY_BENEFICIARY_INQUIRY_PATH,
    operationName: 'Payment gateway beneficiary inquiry',
  });
}

async function initiateIntraTransaction(options = {}) {
  return performManagedSignedGatewayRequest({
    ...options,
    path: env.PAYMENT_GATEWAY_FUND_TRANSFER_PATH,
    operationName: 'Payment gateway intra transaction initiation',
  });
}

async function getCurrentPaymentStatus(options = {}) {
  return performManagedSignedGatewayRequest({
    ...options,
    path: env.PAYMENT_GATEWAY_TRANSACTION_STATUS_TODAY_PATH,
    operationName: 'Payment gateway current-day transaction status request',
  });
}

async function getHistoricalPaymentStatus(options = {}) {
  return performManagedSignedGatewayRequest({
    ...options,
    path: env.PAYMENT_GATEWAY_TRANSACTION_STATUS_HISTORY_PATH,
    operationName: 'Payment gateway subsequent-day transaction status request',
  });
}

async function initiateCustomerBuyBtn(userId, options = {}) {
  const { user, primaryWallet, issuerBank, reserveAccount } = await getCustomerBuyContext(userId);
  const tokenAmount = normalizePositiveAmount(options.amount, 'amount');
  const fiatAmount = calculateFiatAmountFromTokenAmount(tokenAmount);
  const sourceAccountNumber = String(options.debitAccount || user.linkedBankAccountNumber).trim();

  if (!getLinkedBankAccountNumbers(user).includes(sourceAccountNumber)) {
    throw new ApiError(400, 'Debit account must match one of the customer linked bank accounts');
  }

  const paymentReference = buildCustomerPaymentReference();
  const customerReference = buildCustomerBuyReference(user.id);
  const requestId = generateGatewayRequestId();
  const transactionTimestamp = formatGatewayTimestamp();
  const purpose = 'Buy BTN for customer wallet funding';
  const sourceAccountInquiry = await cbsService.accountInquiry({
    accountNumber: sourceAccountNumber,
  });
  const sourceAccountName = sourceAccountInquiry.summary.accountName || user.fullName;

  const beneficiaryInquiryPayload = {
    request_id: requestId,
    source_app: env.PAYMENT_GATEWAY_SOURCE_APP,
    amount: fiatAmount,
    currency: env.BTN_REFERENCE_PRICE_CURRENCY,
    source_account_number: sourceAccountNumber,
    soure_account_number: sourceAccountNumber,
    bene_account_number: reserveAccount.accountNumber,
    bene_bank_code: issuerBank.code,
  };
  const beneficiaryInquiryResult = await beneficiaryAccountInquiry({
    payload: beneficiaryInquiryPayload,
  });
  const inquiryId = extractGatewayInquiryId(beneficiaryInquiryResult.payload);

  if (!inquiryId) {
    throw new ApiError(502, 'Payment gateway beneficiary inquiry did not return an inquiry id');
  }

  const requestPayload = {
    request_id: requestId,
    transaction_datetime: transactionTimestamp,
    source_app: env.PAYMENT_GATEWAY_SOURCE_APP,
    transaction_amount: fiatAmount,
    payment_type: 'INTRA',
    source_account_name: sourceAccountName,
    bene_cust_name: reserveAccount.accountName,
    bene_account_number: reserveAccount.accountNumber,
    bene_bank_code: issuerBank.code,
    inquiry_id: inquiryId,
    narration: purpose,
    payment_reference: paymentReference,
    customer_reference: customerReference,
    amount: fiatAmount,
    currency: env.BTN_REFERENCE_PRICE_CURRENCY,
    source_account_number: sourceAccountNumber,
    beneficiary_account_number: reserveAccount.accountNumber,
    beneficiary_account_name: reserveAccount.accountName,
    payer_name: user.fullName,
    payer_account: sourceAccountNumber,
    purpose,
    remarks: purpose,
    source_wallet_address: primaryWallet.walletAddress,
    token_amount: tokenAmount,
    token_symbol: 'BTN',
    issuer_bank_code: issuerBank.code,
    issuer_bank_name: issuerBank.name,
  };

  await prisma.paymentTransaction.upsert({
    where: {
      paymentReference,
    },
    create: {
      gatewayName: env.PAYMENT_GATEWAY_NAME,
      paymentReference,
      customerReference,
      payerName: user.fullName,
      payerAccount: sourceAccountNumber,
      amount: fiatAmount,
      currency: env.BTN_REFERENCE_PRICE_CURRENCY,
      status: 'INITIATED',
      statusMessage: 'Customer BTN purchase payment initiated from portal.',
      parsedPayload: {
        initiatedBy: 'CUSTOMER_PORTAL',
        customerId: user.id,
        customerCid: user.cid,
        sourceWalletAddress: primaryWallet.walletAddress,
        issuerBankId: issuerBank.id,
        reserveAccountNumber: reserveAccount.accountNumber,
        reserveAccountName: reserveAccount.accountName,
        requestId,
        inquiryId,
        sourceAccountName,
        tokenAmount,
        fiatAmount,
        beneficiaryInquiryPayload,
        beneficiaryInquiryResponse: beneficiaryInquiryResult.payload,
        requestPayload,
      },
    },
    update: {
      customerReference,
      payerName: user.fullName,
      payerAccount: sourceAccountNumber,
      amount: fiatAmount,
      currency: env.BTN_REFERENCE_PRICE_CURRENCY,
      status: 'INITIATED',
      statusMessage: 'Customer BTN purchase payment re-initiated from portal.',
      parsedPayload: {
        initiatedBy: 'CUSTOMER_PORTAL',
        customerId: user.id,
        customerCid: user.cid,
        sourceWalletAddress: primaryWallet.walletAddress,
        issuerBankId: issuerBank.id,
        reserveAccountNumber: reserveAccount.accountNumber,
        reserveAccountName: reserveAccount.accountName,
        requestId,
        inquiryId,
        sourceAccountName,
        tokenAmount,
        fiatAmount,
        beneficiaryInquiryPayload,
        beneficiaryInquiryResponse: beneficiaryInquiryResult.payload,
        requestPayload,
      },
    },
  });

  const gatewayResult = await initiateIntraTransaction({
    payload: requestPayload,
  });

  const normalizedGatewayResponse = normalizePaymentPayload(gatewayResult.payload, paymentReference, env.PAYMENT_GATEWAY_NAME);

  await prisma.paymentTransaction.update({
    where: {
      paymentReference,
    },
    data: {
      parsedPayload: {
        initiatedBy: 'CUSTOMER_PORTAL',
        customerId: user.id,
        customerCid: user.cid,
        sourceWalletAddress: primaryWallet.walletAddress,
        issuerBankId: issuerBank.id,
        reserveAccountNumber: reserveAccount.accountNumber,
        reserveAccountName: reserveAccount.accountName,
        requestId,
        inquiryId,
        sourceAccountName,
        tokenAmount,
        fiatAmount,
        beneficiaryInquiryPayload,
        beneficiaryInquiryResponse: beneficiaryInquiryResult.payload,
        requestPayload,
        gatewayInitiationResponse: gatewayResult.payload,
      },
    },
  });

  if (normalizedGatewayResponse) {
    await upsertPaymentTransaction({
      normalized: {
        ...normalizedGatewayResponse,
        customerReference,
        payerName: normalizedGatewayResponse.payerName || user.fullName,
        payerAccount: normalizedGatewayResponse.payerAccount || sourceAccountNumber,
      },
      parsedPayload: {
        initiatedBy: 'CUSTOMER_PORTAL',
        customerId: user.id,
        customerCid: user.cid,
        sourceWalletAddress: primaryWallet.walletAddress,
        issuerBankId: issuerBank.id,
        reserveAccountNumber: reserveAccount.accountNumber,
        reserveAccountName: reserveAccount.accountName,
        requestId,
        inquiryId,
        sourceAccountName,
        tokenAmount,
        fiatAmount,
        beneficiaryInquiryPayload,
        beneficiaryInquiryResponse: beneficiaryInquiryResult.payload,
        requestPayload,
        gatewayInitiationResponse: gatewayResult.payload,
      },
    });
  }

  return {
    paymentReference,
    customerReference,
    tokenAmount,
    fiatAmount,
    currency: env.BTN_REFERENCE_PRICE_CURRENCY,
    customer: {
      id: user.id,
      fullName: user.fullName,
      cid: user.cid,
      primaryWalletAddress: primaryWallet.walletAddress,
      linkedBankAccountNumber: user.linkedBankAccountNumber,
      linkedBankAccountNumbers: getLinkedBankAccountNumbers(user),
    },
    destination: {
      issuerBankId: issuerBank.id,
      issuerBankName: issuerBank.name,
      issuerBankCode: issuerBank.code,
      reserveAccountNumber: reserveAccount.accountNumber,
      reserveAccountName: reserveAccount.accountName,
    },
    gateway: gatewayResult,
  };
}

async function initiateCustomerSellBtn(userId, options = {}) {
  const {
    user,
    primaryWallet,
    issuerBank,
    reserveAccount,
    managedToken,
    walletBtnBalance,
  } = await getCustomerSellContext(userId);
  const tokenAmount = normalizePositiveAmount(options.amount, 'amount');
  const fiatAmount = calculateFiatAmountFromTokenAmount(tokenAmount);
  const payoutAccountNumber = String(options.payoutAccount || user.linkedBankAccountNumber).trim();
  const selectedPayoutAccount = findLinkedBankAccount(user, payoutAccountNumber);
  const walletAvailableRawAmount = BigInt(String(walletBtnBalance?.rawAmount || '0'));
  const requiredRawAmount = BigInt(convertDisplayAmountToRawAmount(tokenAmount, walletBtnBalance?.decimals ?? 0));

  if (!getLinkedBankAccountNumbers(user).includes(payoutAccountNumber)) {
    throw new ApiError(400, 'Payout account must match one of the customer linked bank accounts');
  }

  if (!selectedPayoutAccount) {
    throw new ApiError(400, 'Selected payout account metadata could not be resolved');
  }

  if (walletAvailableRawAmount < requiredRawAmount) {
    throw new ApiError(
      409,
      `Customer wallet has insufficient BTN balance. Available ${walletAvailableRawAmount.toString()}, required ${requiredRawAmount.toString()}.`,
    );
  }

  const delegationStatus = await solanaService.getCustomerSellDelegationStatus({
    mintAddress: managedToken.mintAddress,
    walletAddress: primaryWallet.walletAddress,
    requiredAmount: tokenAmount,
  });

  if (!delegationStatus.sufficient) {
    throw new ApiError(
      409,
      'Automatic sell is not enabled for this wallet yet. Approve customer sell delegation first.',
    );
  }

  const distributionTokenAccount = await solanaService.resolveBankDistributionTokenAccount(
    issuerBank.id,
    managedToken.mintAddress,
  );
  const payoutBankCode = String(selectedPayoutAccount.bankCode || issuerBank.code || '').trim();
  const payoutBankName = selectedPayoutAccount.bankName || issuerBank.name;
  const payoutRail = payoutBankCode === issuerBank.code ? env.PAYMENT_GATEWAY_NAME : BIPS_GATEWAY_NAME;
  const paymentReference = buildCustomerPaymentReference(CUSTOMER_BTN_PAYMENT_PREFIXES.SELL);
  const customerReference = buildCustomerSellReference(user.id);
  const requestId = generateGatewayRequestId();
  const transactionTimestamp = formatGatewayTimestamp();
  const purpose = 'Sell BTN for fiat payout to customer';

  if (payoutRail === env.PAYMENT_GATEWAY_NAME) {
    const beneficiaryInquiryPayload = {
      request_id: requestId,
      source_app: env.PAYMENT_GATEWAY_SOURCE_APP,
      amount: fiatAmount,
      currency: env.BTN_REFERENCE_PRICE_CURRENCY,
      source_account_name: reserveAccount.accountName,
      source_account_number: reserveAccount.accountNumber,
      soure_account_number: reserveAccount.accountNumber,
      bene_account_number: payoutAccountNumber,
      bene_bank_code: issuerBank.code,
    };
    const beneficiaryInquiryResult = await beneficiaryAccountInquiry({
      payload: beneficiaryInquiryPayload,
    });
    const inquiryId = extractGatewayInquiryId(beneficiaryInquiryResult.payload);

    if (!inquiryId) {
      throw new ApiError(502, 'Payment gateway beneficiary inquiry did not return an inquiry id');
    }

    const requestPayload = {
      request_id: requestId,
      transaction_datetime: transactionTimestamp,
      source_app: env.PAYMENT_GATEWAY_SOURCE_APP,
      transaction_amount: fiatAmount,
      payment_type: 'INTRA',
      source_account_name: reserveAccount.accountName,
      source_account_number: reserveAccount.accountNumber,
      bene_cust_name: user.fullName,
      bene_account_number: payoutAccountNumber,
      bene_bank_code: issuerBank.code,
      inquiry_id: inquiryId,
      narration: purpose,
      payment_reference: paymentReference,
      customer_reference: customerReference,
      amount: fiatAmount,
      currency: env.BTN_REFERENCE_PRICE_CURRENCY,
      payer_name: reserveAccount.accountName,
      payer_account: reserveAccount.accountNumber,
      purpose,
      remarks: purpose,
      source_wallet_address: primaryWallet.walletAddress,
      token_amount: tokenAmount,
      token_symbol: 'BTN',
      mint_address: managedToken.mintAddress,
      issuer_bank_code: issuerBank.code,
      issuer_bank_name: issuerBank.name,
      distribution_wallet_address: distributionTokenAccount.treasuryWalletAddress,
      distribution_token_account_address: distributionTokenAccount.tokenAccountAddress,
      payout_bank_code: payoutBankCode,
      payout_bank_name: payoutBankName,
      payout_rail: payoutRail,
    };

    await prisma.paymentTransaction.upsert({
      where: {
        paymentReference,
      },
      create: {
        gatewayName: env.PAYMENT_GATEWAY_NAME,
        paymentReference,
        customerReference,
        payerName: reserveAccount.accountName,
        payerAccount: reserveAccount.accountNumber,
        amount: fiatAmount,
        currency: env.BTN_REFERENCE_PRICE_CURRENCY,
        status: 'INITIATED',
        statusMessage: 'Customer BTN sell payout initiated from portal.',
        parsedPayload: {
          initiatedBy: 'CUSTOMER_PORTAL',
          customerId: user.id,
          customerCid: user.cid,
          sourceWalletAddress: primaryWallet.walletAddress,
          issuerBankId: issuerBank.id,
          reserveAccountNumber: reserveAccount.accountNumber,
          reserveAccountName: reserveAccount.accountName,
          statusBeneficiaryAccountNumber: payoutAccountNumber,
          payoutAccountNumber,
          payoutBankCode,
          payoutBankName,
          payoutRail,
          distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
          distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
          requestId,
          inquiryId,
          tokenAmount,
          fiatAmount,
          mintAddress: managedToken.mintAddress,
          beneficiaryInquiryPayload,
          beneficiaryInquiryResponse: beneficiaryInquiryResult.payload,
          requestPayload,
        },
      },
      update: {
        customerReference,
        payerName: reserveAccount.accountName,
        payerAccount: reserveAccount.accountNumber,
        amount: fiatAmount,
        currency: env.BTN_REFERENCE_PRICE_CURRENCY,
        status: 'INITIATED',
        statusMessage: 'Customer BTN sell payout re-initiated from portal.',
        parsedPayload: {
          initiatedBy: 'CUSTOMER_PORTAL',
          customerId: user.id,
          customerCid: user.cid,
          sourceWalletAddress: primaryWallet.walletAddress,
          issuerBankId: issuerBank.id,
          reserveAccountNumber: reserveAccount.accountNumber,
          reserveAccountName: reserveAccount.accountName,
          statusBeneficiaryAccountNumber: payoutAccountNumber,
          payoutAccountNumber,
          payoutBankCode,
          payoutBankName,
          payoutRail,
          distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
          distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
          requestId,
          inquiryId,
          tokenAmount,
          fiatAmount,
          mintAddress: managedToken.mintAddress,
          beneficiaryInquiryPayload,
          beneficiaryInquiryResponse: beneficiaryInquiryResult.payload,
          requestPayload,
        },
      },
    });

    const gatewayResult = await initiateIntraTransaction({
      payload: requestPayload,
    });

    const normalizedGatewayResponse = normalizePaymentPayload(gatewayResult.payload, paymentReference, env.PAYMENT_GATEWAY_NAME);

    await prisma.paymentTransaction.update({
      where: {
        paymentReference,
      },
      data: {
        parsedPayload: {
          initiatedBy: 'CUSTOMER_PORTAL',
          customerId: user.id,
          customerCid: user.cid,
          sourceWalletAddress: primaryWallet.walletAddress,
          issuerBankId: issuerBank.id,
          reserveAccountNumber: reserveAccount.accountNumber,
          reserveAccountName: reserveAccount.accountName,
          statusBeneficiaryAccountNumber: payoutAccountNumber,
          payoutAccountNumber,
          payoutBankCode,
          payoutBankName,
          payoutRail,
          distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
          distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
          requestId,
          inquiryId,
          tokenAmount,
          fiatAmount,
          mintAddress: managedToken.mintAddress,
          beneficiaryInquiryPayload,
          beneficiaryInquiryResponse: beneficiaryInquiryResult.payload,
          requestPayload,
          gatewayInitiationResponse: gatewayResult.payload,
        },
      },
    });

    if (normalizedGatewayResponse) {
      await upsertPaymentTransaction({
        normalized: {
          ...normalizedGatewayResponse,
          customerReference,
          payerName: normalizedGatewayResponse.payerName || reserveAccount.accountName,
          payerAccount: normalizedGatewayResponse.payerAccount || reserveAccount.accountNumber,
        },
        parsedPayload: {
          initiatedBy: 'CUSTOMER_PORTAL',
          customerId: user.id,
          customerCid: user.cid,
          sourceWalletAddress: primaryWallet.walletAddress,
          issuerBankId: issuerBank.id,
          reserveAccountNumber: reserveAccount.accountNumber,
          reserveAccountName: reserveAccount.accountName,
          statusBeneficiaryAccountNumber: payoutAccountNumber,
          payoutAccountNumber,
          payoutBankCode,
          payoutBankName,
          payoutRail,
          distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
          distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
          requestId,
          inquiryId,
          tokenAmount,
          fiatAmount,
          mintAddress: managedToken.mintAddress,
          beneficiaryInquiryPayload,
          beneficiaryInquiryResponse: beneficiaryInquiryResult.payload,
          requestPayload,
          gatewayInitiationResponse: gatewayResult.payload,
        },
      });
    }

    return {
      paymentReference,
      customerReference,
      tokenAmount,
      fiatAmount,
      currency: env.BTN_REFERENCE_PRICE_CURRENCY,
      payoutRail,
      customer: {
        id: user.id,
        fullName: user.fullName,
        cid: user.cid,
        primaryWalletAddress: primaryWallet.walletAddress,
        linkedBankAccountNumber: user.linkedBankAccountNumber,
      },
      payout: {
        issuerBankId: issuerBank.id,
        issuerBankName: issuerBank.name,
        issuerBankCode: issuerBank.code,
        reserveAccountNumber: reserveAccount.accountNumber,
        reserveAccountName: reserveAccount.accountName,
        beneficiaryAccountNumber: payoutAccountNumber,
        beneficiaryBankCode: payoutBankCode,
        beneficiaryBankName: payoutBankName,
        beneficiaryName: user.fullName,
      },
      tokenReturn: {
        mintAddress: managedToken.mintAddress,
        sourceWalletAddress: primaryWallet.walletAddress,
        distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
        distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
      },
      gateway: gatewayResult,
    };
  }

  const beneficiaryInquiryPayload = {
    Amount: fiatAmount,
    BeneficiaryAccountNumber: payoutAccountNumber,
    BeneficiaryBankCode: payoutBankCode,
    SourceAccountName: reserveAccount.accountName,
    SourceAccountNumber: reserveAccount.accountNumber,
    SourceBankCode: issuerBank.code,
    TransferPurpose: purpose,
    request_id: requestId,
  };
  const beneficiaryInquiryResult = await bipsService.accountInquiry(beneficiaryInquiryPayload);
  const inquiryResponseCode = extractBipsResponseCode(beneficiaryInquiryResult);
  const inquiryError = resolveBipsError(inquiryResponseCode);

  if (inquiryResponseCode !== '0000') {
    throw new ApiError(502, extractBipsResponseMessage(beneficiaryInquiryResult) || inquiryError.message);
  }

  const referenceNumber = extractBipsReferenceNumber(beneficiaryInquiryResult);
  if (!referenceNumber) {
    throw new ApiError(502, 'BIPS account inquiry did not return a reference number');
  }

  const beneficiaryAccountName = extractBipsBeneficiaryAccountName(beneficiaryInquiryResult)
    || selectedPayoutAccount.accountName
    || user.fullName;
  const requestPayload = {
    ...beneficiaryInquiryPayload,
    BeneficiaryAccountName: beneficiaryAccountName,
    reference_number: referenceNumber,
  };

  await prisma.paymentTransaction.upsert({
    where: {
      paymentReference,
    },
    create: {
      gatewayName: BIPS_GATEWAY_NAME,
      paymentReference,
      customerReference,
      payerName: reserveAccount.accountName,
      payerAccount: reserveAccount.accountNumber,
      amount: fiatAmount,
      currency: env.BTN_REFERENCE_PRICE_CURRENCY,
      status: 'INITIATED',
      statusMessage: 'Customer BTN sell payout initiated through BIPS.',
      parsedPayload: {
        initiatedBy: 'CUSTOMER_PORTAL',
        customerId: user.id,
        customerCid: user.cid,
        sourceWalletAddress: primaryWallet.walletAddress,
        issuerBankId: issuerBank.id,
        reserveAccountNumber: reserveAccount.accountNumber,
        reserveAccountName: reserveAccount.accountName,
        statusBeneficiaryAccountNumber: payoutAccountNumber,
        payoutAccountNumber,
        payoutBankCode,
        payoutBankName,
        payoutRail,
        distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
        distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
        requestId,
        referenceNumber,
        tokenAmount,
        fiatAmount,
        mintAddress: managedToken.mintAddress,
        beneficiaryInquiryPayload,
        beneficiaryInquiryResponse: beneficiaryInquiryResult,
        requestPayload,
      },
    },
    update: {
      gatewayName: BIPS_GATEWAY_NAME,
      customerReference,
      payerName: reserveAccount.accountName,
      payerAccount: reserveAccount.accountNumber,
      amount: fiatAmount,
      currency: env.BTN_REFERENCE_PRICE_CURRENCY,
      status: 'INITIATED',
      statusMessage: 'Customer BTN sell payout re-initiated through BIPS.',
      parsedPayload: {
        initiatedBy: 'CUSTOMER_PORTAL',
        customerId: user.id,
        customerCid: user.cid,
        sourceWalletAddress: primaryWallet.walletAddress,
        issuerBankId: issuerBank.id,
        reserveAccountNumber: reserveAccount.accountNumber,
        reserveAccountName: reserveAccount.accountName,
        statusBeneficiaryAccountNumber: payoutAccountNumber,
        payoutAccountNumber,
        payoutBankCode,
        payoutBankName,
        payoutRail,
        distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
        distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
        requestId,
        referenceNumber,
        tokenAmount,
        fiatAmount,
        mintAddress: managedToken.mintAddress,
        beneficiaryInquiryPayload,
        beneficiaryInquiryResponse: beneficiaryInquiryResult,
        requestPayload,
      },
    },
  });

  const outgoingResult = await bipsService.outgoingTransfer(requestPayload);
  const bipsTransactionId = extractBipsTransactionId(outgoingResult);
  let statusVerification = null;

  if (bipsTransactionId) {
    try {
      statusVerification = await bipsService.checkTransactionStatus(bipsTransactionId);
    } catch (error) {
      statusVerification = {
        response_code: '3001',
        response_message: error.message,
        response_description: error.message,
      };
    }
  }

  const nextStatus = normalizeBipsPaymentStatus(statusVerification || outgoingResult, 'INITIATED');
  const statusResponseCode = extractBipsResponseCode(statusVerification || outgoingResult);
  const resolved = resolveBipsError(statusResponseCode);
  const statusMessage = statusVerification?.error
    || extractBipsResponseMessage(statusVerification)
    || extractBipsResponseMessage(outgoingResult)
    || (isBipsRecordNotFound(statusResponseCode) ? 'BIPS payout was initiated successfully. Final status is not available yet.' : null)
    || resolved.message
    || (nextStatus === 'COMPLETED'
      ? 'BIPS payout completed successfully.'
      : 'BIPS payout initiated and awaiting confirmation.');

  await upsertPaymentTransaction({
    normalized: {
      gatewayName: BIPS_GATEWAY_NAME,
      paymentReference,
      gatewayTransactionId: bipsTransactionId,
      customerReference,
      payerName: reserveAccount.accountName,
      payerAccount: reserveAccount.accountNumber,
      amount: fiatAmount,
      currency: env.BTN_REFERENCE_PRICE_CURRENCY,
      status: nextStatus,
      statusMessage,
      confirmedAt: nextStatus === 'COMPLETED' ? new Date() : null,
    },
    parsedPayload: {
      initiatedBy: 'CUSTOMER_PORTAL',
      customerId: user.id,
      customerCid: user.cid,
      sourceWalletAddress: primaryWallet.walletAddress,
      issuerBankId: issuerBank.id,
      reserveAccountNumber: reserveAccount.accountNumber,
      reserveAccountName: reserveAccount.accountName,
      statusBeneficiaryAccountNumber: payoutAccountNumber,
      payoutAccountNumber,
      payoutBankCode,
      payoutBankName,
      payoutRail,
      distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
      distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
      requestId,
      referenceNumber,
      rrNumber: bipsTransactionId,
      tokenAmount,
      fiatAmount,
      mintAddress: managedToken.mintAddress,
      beneficiaryInquiryPayload,
      beneficiaryInquiryResponse: beneficiaryInquiryResult,
      requestPayload,
      bipsOutgoingResponse: outgoingResult,
      bipsStatusVerification: statusVerification,
    },
    rawStatusResponse: statusVerification
      ? {
        mode: 'BIPS_STATUS_CHECK',
        payload: statusVerification,
      }
      : undefined,
    parsedStatus: statusVerification
      ? {
        bipsStatusVerification: statusVerification,
      }
      : undefined,
  });

  return {
    paymentReference,
    customerReference,
    tokenAmount,
    fiatAmount,
    currency: env.BTN_REFERENCE_PRICE_CURRENCY,
    payoutRail,
    customer: {
      id: user.id,
      fullName: user.fullName,
      cid: user.cid,
      primaryWalletAddress: primaryWallet.walletAddress,
      linkedBankAccountNumber: user.linkedBankAccountNumber,
    },
    payout: {
      issuerBankId: issuerBank.id,
      issuerBankName: issuerBank.name,
      issuerBankCode: issuerBank.code,
      reserveAccountNumber: reserveAccount.accountNumber,
      reserveAccountName: reserveAccount.accountName,
      beneficiaryAccountNumber: payoutAccountNumber,
      beneficiaryBankCode: payoutBankCode,
      beneficiaryBankName: payoutBankName,
      beneficiaryName: beneficiaryAccountName,
    },
    tokenReturn: {
      mintAddress: managedToken.mintAddress,
      sourceWalletAddress: primaryWallet.walletAddress,
      distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
      distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
    },
    bips: {
      inquiry: beneficiaryInquiryResult,
      outgoing: outgoingResult,
      statusVerification,
    },
  };
}

async function initiateCustomerTransferBtn(userId, options = {}) {
  const {
    user,
    primaryWallet,
    issuerBank,
    reserveAccount,
    managedToken,
    walletBtnBalance,
    recipientUser,
    recipientPrimaryWallet,
  } = await getCustomerTransferContext(userId, options.recipientCid);
  const tokenAmount = normalizePositiveAmount(options.amount, 'amount');
  const fiatAmount = calculateFiatAmountFromTokenAmount(tokenAmount);
  const walletAvailableRawAmount = BigInt(String(walletBtnBalance?.rawAmount || '0'));
  const requiredRawAmount = BigInt(convertDisplayAmountToRawAmount(tokenAmount, walletBtnBalance?.decimals ?? 0));
  const recipientLinkedBankAccountNumbers = getLinkedBankAccountNumbers(recipientUser);
  const recipientLinkedBankAccountNumber = recipientLinkedBankAccountNumbers[0] || null;

  if (walletAvailableRawAmount < requiredRawAmount) {
    throw new ApiError(
      409,
      `Customer wallet has insufficient BTN balance. Available ${walletAvailableRawAmount.toString()}, required ${requiredRawAmount.toString()}.`,
    );
  }

  const delegationStatus = await solanaService.getCustomerSellDelegationStatus({
    mintAddress: managedToken.mintAddress,
    walletAddress: primaryWallet.walletAddress,
    requiredAmount: tokenAmount,
  });

  if (!delegationStatus.sufficient) {
    throw new ApiError(
      409,
      'Automatic transfer is not enabled for this wallet yet. Approve customer sell delegation first.',
    );
  }

  const paymentReference = buildCustomerPaymentReference(CUSTOMER_BTN_PAYMENT_PREFIXES.TRANSFER);
  const customerReference = buildCustomerTransferReference(user.id);

  if (recipientPrimaryWallet?.walletAddress) {
    const transferResult = await solanaService.transferFromCustomerWalletToWallet({
      mintAddress: managedToken.mintAddress,
      amount: tokenAmount,
      sourceWalletAddress: primaryWallet.walletAddress,
      destinationWalletAddress: recipientPrimaryWallet.walletAddress,
    });

    const transaction = await prisma.paymentTransaction.create({
      data: {
        gatewayName: 'INTERNAL_BTN_TRANSFER',
        paymentReference,
        customerReference,
        payerName: user.fullName,
        payerAccount: user.linkedBankAccountNumber,
        amount: fiatAmount,
        currency: env.BTN_REFERENCE_PRICE_CURRENCY,
        status: 'COMPLETED',
        statusMessage: 'BTN transferred successfully to the recipient wallet.',
        confirmedAt: new Date(),
        parsedPayload: {
          initiatedBy: 'CUSTOMER_PORTAL',
          transferMode: 'WALLET',
          customerId: user.id,
          customerCid: user.cid,
          sourceWalletAddress: primaryWallet.walletAddress,
          tokenAmount,
          fiatAmount,
          mintAddress: managedToken.mintAddress,
          recipientUserId: recipientUser.id,
          recipientCid: recipientUser.cid,
          recipientName: recipientUser.fullName,
          recipientWalletAddress: recipientPrimaryWallet.walletAddress,
          fulfillment: {
            status: 'COMPLETED',
            updatedAt: new Date().toISOString(),
            transfer: transferResult,
            statusMessage: 'BTN transferred successfully to the recipient wallet.',
          },
        },
      },
    });

    return {
      paymentReference,
      customerReference,
      mode: 'WALLET',
      tokenAmount,
      fiatAmount,
      currency: env.BTN_REFERENCE_PRICE_CURRENCY,
      customer: {
        id: user.id,
        fullName: user.fullName,
        cid: user.cid,
        primaryWalletAddress: primaryWallet.walletAddress,
      },
      recipient: {
        id: recipientUser.id,
        fullName: recipientUser.fullName,
        cid: recipientUser.cid,
        primaryWalletAddress: recipientPrimaryWallet.walletAddress,
        linkedBankAccountNumber: recipientUser.linkedBankAccountNumber,
        linkedBankAccountNumbers: recipientLinkedBankAccountNumbers,
      },
      transaction,
    };
  }

  if (!recipientLinkedBankAccountNumber) {
    throw new ApiError(400, 'Recipient customer has neither an active wallet nor a linked bank account');
  }

  const distributionTokenAccount = await solanaService.resolveBankDistributionTokenAccount(
    issuerBank.id,
    managedToken.mintAddress,
  );
  const requestId = generateGatewayRequestId();
  const transactionTimestamp = formatGatewayTimestamp();
  const purpose = 'BTN transfer fiat fallback payout';
  const beneficiaryInquiryPayload = {
    request_id: requestId,
    source_app: env.PAYMENT_GATEWAY_SOURCE_APP,
    amount: fiatAmount,
    currency: env.BTN_REFERENCE_PRICE_CURRENCY,
    source_account_name: reserveAccount.accountName,
    source_account_number: reserveAccount.accountNumber,
    soure_account_number: reserveAccount.accountNumber,
    bene_account_number: recipientLinkedBankAccountNumber,
    bene_bank_code: issuerBank.code,
  };
  const beneficiaryInquiryResult = await beneficiaryAccountInquiry({
    payload: beneficiaryInquiryPayload,
  });
  const inquiryId = extractGatewayInquiryId(beneficiaryInquiryResult.payload);

  if (!inquiryId) {
    throw new ApiError(502, 'Payment gateway beneficiary inquiry did not return an inquiry id');
  }

  const requestPayload = {
    request_id: requestId,
    transaction_datetime: transactionTimestamp,
    source_app: env.PAYMENT_GATEWAY_SOURCE_APP,
    transaction_amount: fiatAmount,
    payment_type: 'INTRA',
    source_account_name: reserveAccount.accountName,
    source_account_number: reserveAccount.accountNumber,
    bene_cust_name: recipientUser.fullName,
    bene_account_number: recipientLinkedBankAccountNumber,
    bene_bank_code: issuerBank.code,
    inquiry_id: inquiryId,
    narration: purpose,
    payment_reference: paymentReference,
    customer_reference: customerReference,
    amount: fiatAmount,
    currency: env.BTN_REFERENCE_PRICE_CURRENCY,
    payer_name: reserveAccount.accountName,
    payer_account: reserveAccount.accountNumber,
    purpose,
    remarks: purpose,
    source_wallet_address: primaryWallet.walletAddress,
    token_amount: tokenAmount,
    token_symbol: 'BTN',
    mint_address: managedToken.mintAddress,
    issuer_bank_code: issuerBank.code,
    issuer_bank_name: issuerBank.name,
    distribution_wallet_address: distributionTokenAccount.treasuryWalletAddress,
    distribution_token_account_address: distributionTokenAccount.tokenAccountAddress,
    recipient_cid: recipientUser.cid,
  };

  await prisma.paymentTransaction.upsert({
    where: {
      paymentReference,
    },
    create: {
      gatewayName: env.PAYMENT_GATEWAY_NAME,
      paymentReference,
      customerReference,
      payerName: reserveAccount.accountName,
      payerAccount: reserveAccount.accountNumber,
      amount: fiatAmount,
      currency: env.BTN_REFERENCE_PRICE_CURRENCY,
      status: 'INITIATED',
      statusMessage: 'Customer BTN transfer fiat fallback payout initiated from portal.',
      parsedPayload: {
        initiatedBy: 'CUSTOMER_PORTAL',
        transferMode: 'FIAT_FALLBACK',
        customerId: user.id,
        customerCid: user.cid,
        recipientUserId: recipientUser.id,
        recipientCid: recipientUser.cid,
        recipientName: recipientUser.fullName,
        sourceWalletAddress: primaryWallet.walletAddress,
        issuerBankId: issuerBank.id,
        reserveAccountNumber: reserveAccount.accountNumber,
        reserveAccountName: reserveAccount.accountName,
        statusBeneficiaryAccountNumber: recipientLinkedBankAccountNumber,
        payoutAccountNumber: recipientLinkedBankAccountNumber,
        distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
        distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
        requestId,
        inquiryId,
        tokenAmount,
        fiatAmount,
        mintAddress: managedToken.mintAddress,
        beneficiaryInquiryPayload,
        beneficiaryInquiryResponse: beneficiaryInquiryResult.payload,
        requestPayload,
      },
    },
    update: {
      customerReference,
      payerName: reserveAccount.accountName,
      payerAccount: reserveAccount.accountNumber,
      amount: fiatAmount,
      currency: env.BTN_REFERENCE_PRICE_CURRENCY,
      status: 'INITIATED',
      statusMessage: 'Customer BTN transfer fiat fallback payout re-initiated from portal.',
      parsedPayload: {
        initiatedBy: 'CUSTOMER_PORTAL',
        transferMode: 'FIAT_FALLBACK',
        customerId: user.id,
        customerCid: user.cid,
        recipientUserId: recipientUser.id,
        recipientCid: recipientUser.cid,
        recipientName: recipientUser.fullName,
        sourceWalletAddress: primaryWallet.walletAddress,
        issuerBankId: issuerBank.id,
        reserveAccountNumber: reserveAccount.accountNumber,
        reserveAccountName: reserveAccount.accountName,
        statusBeneficiaryAccountNumber: recipientLinkedBankAccountNumber,
        payoutAccountNumber: recipientLinkedBankAccountNumber,
        distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
        distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
        requestId,
        inquiryId,
        tokenAmount,
        fiatAmount,
        mintAddress: managedToken.mintAddress,
        beneficiaryInquiryPayload,
        beneficiaryInquiryResponse: beneficiaryInquiryResult.payload,
        requestPayload,
      },
    },
  });

  const gatewayResult = await initiateIntraTransaction({
    payload: requestPayload,
  });
  const normalizedGatewayResponse = normalizePaymentPayload(gatewayResult.payload, paymentReference, env.PAYMENT_GATEWAY_NAME);

  await prisma.paymentTransaction.update({
    where: {
      paymentReference,
    },
    data: {
      parsedPayload: {
        initiatedBy: 'CUSTOMER_PORTAL',
        transferMode: 'FIAT_FALLBACK',
        customerId: user.id,
        customerCid: user.cid,
        recipientUserId: recipientUser.id,
        recipientCid: recipientUser.cid,
        recipientName: recipientUser.fullName,
        sourceWalletAddress: primaryWallet.walletAddress,
        issuerBankId: issuerBank.id,
        reserveAccountNumber: reserveAccount.accountNumber,
        reserveAccountName: reserveAccount.accountName,
        statusBeneficiaryAccountNumber: recipientLinkedBankAccountNumber,
        payoutAccountNumber: recipientLinkedBankAccountNumber,
        distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
        distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
        requestId,
        inquiryId,
        tokenAmount,
        fiatAmount,
        mintAddress: managedToken.mintAddress,
        beneficiaryInquiryPayload,
        beneficiaryInquiryResponse: beneficiaryInquiryResult.payload,
        requestPayload,
        gatewayInitiationResponse: gatewayResult.payload,
      },
    },
  });

  if (normalizedGatewayResponse) {
    await upsertPaymentTransaction({
      normalized: {
        ...normalizedGatewayResponse,
        customerReference,
        payerName: normalizedGatewayResponse.payerName || reserveAccount.accountName,
        payerAccount: normalizedGatewayResponse.payerAccount || reserveAccount.accountNumber,
      },
      parsedPayload: {
        initiatedBy: 'CUSTOMER_PORTAL',
        transferMode: 'FIAT_FALLBACK',
        customerId: user.id,
        customerCid: user.cid,
        recipientUserId: recipientUser.id,
        recipientCid: recipientUser.cid,
        recipientName: recipientUser.fullName,
        sourceWalletAddress: primaryWallet.walletAddress,
        issuerBankId: issuerBank.id,
        reserveAccountNumber: reserveAccount.accountNumber,
        reserveAccountName: reserveAccount.accountName,
        statusBeneficiaryAccountNumber: recipientLinkedBankAccountNumber,
        payoutAccountNumber: recipientLinkedBankAccountNumber,
        distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
        distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
        requestId,
        inquiryId,
        tokenAmount,
        fiatAmount,
        mintAddress: managedToken.mintAddress,
        beneficiaryInquiryPayload,
        beneficiaryInquiryResponse: beneficiaryInquiryResult.payload,
        requestPayload,
        gatewayInitiationResponse: gatewayResult.payload,
      },
    });
  }

  return {
    paymentReference,
    customerReference,
    mode: 'FIAT_FALLBACK',
    tokenAmount,
    fiatAmount,
    currency: env.BTN_REFERENCE_PRICE_CURRENCY,
    customer: {
      id: user.id,
      fullName: user.fullName,
      cid: user.cid,
      primaryWalletAddress: primaryWallet.walletAddress,
      linkedBankAccountNumber: user.linkedBankAccountNumber,
      linkedBankAccountNumbers: getLinkedBankAccountNumbers(user),
    },
    recipient: {
      id: recipientUser.id,
      fullName: recipientUser.fullName,
      cid: recipientUser.cid,
      primaryWalletAddress: null,
      linkedBankAccountNumber: recipientLinkedBankAccountNumber,
      linkedBankAccountNumbers: recipientLinkedBankAccountNumbers,
    },
    payout: {
      beneficiaryAccountNumber: recipientLinkedBankAccountNumber,
      beneficiaryName: recipientUser.fullName,
    },
    tokenReturn: {
      mintAddress: managedToken.mintAddress,
      distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
      distributionTokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
    },
    gateway: gatewayResult,
  };
}

async function getCustomerPaymentTransaction(userId, paymentReference) {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: {
      paymentReference,
    },
  });

  if (!transaction) {
    throw new ApiError(404, 'Payment transaction not found');
  }

  const customerReference = String(transaction.customerReference || '');
  const belongsToCustomer = customerReference.startsWith(`BTN_BUY:${userId}:`)
    || customerReference.startsWith(`BTN_SELL:${userId}:`)
    || customerReference.startsWith(`BTN_TRANSFER:${userId}:`);

  if (!belongsToCustomer) {
    throw new ApiError(404, 'Payment transaction not found');
  }

  const reserveLedger = await reserveService.findReserveByPaymentReference(paymentReference);

  return {
    ...transaction,
    reserveLedger,
  };
}

async function verifyCustomerPaymentStatus(userId, paymentReference) {
  await getCustomerPaymentTransaction(userId, paymentReference);
  await verifyPaymentStatus(paymentReference);
  return getCustomerPaymentTransaction(userId, paymentReference);
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
  authorizeGatewayPullPayment,
  authorizePullPayment,
  beneficiaryAccountInquiry,
  createGatewayDebitRequest,
  debitPullPayment,
  fetchGatewayAuthorizationToken,
  fetchGatewaySigningKey,
  generateGatewaySignature,
  getCurrentPaymentStatus,
  getCustomerPaymentTransaction,
  getHistoricalPaymentStatus,
  getGatewayTransactionStatusForHistory,
  getGatewayTransactionStatusForToday,
  initiateCustomerBuyBtn,
  initiateCustomerSellBtn,
  initiateCustomerTransferBtn,
  ingestPaymentCallback,
  initiateIntraTransaction,
  initiateGatewayIntraTransaction,
  inquireGatewayBeneficiaryAccount,
  getPaymentTransactionByReference,
  reconcilePendingPayments,
  verifyCustomerPaymentStatus,
  verifyPaymentStatus,
};
