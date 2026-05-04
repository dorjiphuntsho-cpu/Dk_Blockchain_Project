const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');

const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const LCY_ACCOUNT_PREFIXES = ['1001', '1101'];
const FCY_ACCOUNT_PREFIXES = ['1201', '1301', '1401', '1501', '1601', '1701', '1807'];
const CBS_TOKEN_CACHE_BUFFER_MS = 30 * 1000;
const CBS_TOKEN_RETRY_DELAY_MS = 500;
const CBS_TOKEN_MAX_ATTEMPTS = 2;
const cbsTokenCache = new Map();

function buildCbsUrl(path) {
  if (!env.CBS_BASE_URL) {
    throw new ApiError(500, 'CBS adapter is not configured');
  }

  const baseUrl = String(env.CBS_BASE_URL).replace(/\/+$/, '');
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  return `${baseUrl}/${normalizedPath}`;
}

function buildCbsApiKeyHeaders() {
  if (!env.CBS_API_KEY) {
    return {};
  }

  return {
    [env.CBS_API_KEY_HEADER]: env.CBS_API_KEY,
  };
}

function generateRequestId() {
  return randomUUID();
}

function formatTimestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
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

function getTokenCacheKey({ sourceApp, scope }) {
  return `${sourceApp}::${scope}`;
}

function getCachedAuthorizationToken({ sourceApp, scope }) {
  const cacheKey = getTokenCacheKey({ sourceApp, scope });
  const cachedEntry = cbsTokenCache.get(cacheKey);

  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now() + CBS_TOKEN_CACHE_BUFFER_MS) {
    cbsTokenCache.delete(cacheKey);
    return null;
  }

  return cachedEntry;
}

function cacheAuthorizationToken({ sourceApp, scope, accessToken, payload, httpStatus, requestId }) {
  if (!accessToken) {
    return;
  }

  const expiresInSeconds = Number(payload?.response_data?.expires_in ?? payload?.response_data?.expiresIn);
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    return;
  }

  const expiresAt = Date.now() + (expiresInSeconds * 1000);
  const cacheKey = getTokenCacheKey({ sourceApp, scope });

  cbsTokenCache.set(cacheKey, {
    accessToken,
    expiresAt,
    httpStatus,
    payload,
    requestId,
    scope,
    sourceApp,
  });
}

function shouldRetryTokenResponse({ responseStatus, responseText, contentType }) {
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

function shouldRetryTokenError(error) {
  if (error instanceof ApiError) {
    return [408, 429, 500, 502, 503, 504].includes(error.statusCode);
  }

  return true;
}

function assertCbsTokenConfig() {
  const missing = [
    ['CBS_BASE_URL', env.CBS_BASE_URL],
    ['CBS_USERNAME', env.CBS_USERNAME],
    ['CBS_PASSWORD', env.CBS_PASSWORD],
    ['CBS_CLIENT_ID', env.CBS_CLIENT_ID],
    ['CBS_CLIENT_SECRET', env.CBS_CLIENT_SECRET],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new ApiError(500, `CBS token configuration is incomplete: ${missing.join(', ')}`);
  }
}

function inferProductType(accountNumber) {
  const normalized = String(accountNumber || '').trim();
  const prefix = normalized.slice(0, 4);

  if (LCY_ACCOUNT_PREFIXES.includes(prefix)) {
    return 'LCY_ACC';
  }

  if (FCY_ACCOUNT_PREFIXES.includes(prefix)) {
    return 'FCY_ACC';
  }

  throw new ApiError(400, `Unable to infer product type for account prefix ${prefix || 'unknown'}`);
}

function normalizeBooleanFlag(value) {
  return String(value || '').trim().toUpperCase() === 'YES';
}

function buildRestrictionSummary(responseData = {}) {
  const classifier = responseData.account_classifier || {};
  const status = responseData.account_status || {};

  const postNoCredit = normalizeBooleanFlag(classifier.pnc_value);
  const postNoDebit = normalizeBooleanFlag(classifier.pnd_value);
  const blockAllTransactions = normalizeBooleanFlag(classifier.bat_value);
  const frozen = normalizeBooleanFlag(classifier.freeze_value);
  const transactionsBlocked = blockAllTransactions || frozen;

  return {
    accountStatusCode: status.acc_status_code || null,
    accountStatusDetails: status.acc_status_details || null,
    productType: status.product_type || null,
    currencyCode: status.currency_code || null,
    clientCategory: classifier.client_cat || null,
    postNoCredit,
    postNoDebit,
    blockAllTransactions,
    frozen,
    canCredit: !transactionsBlocked && !postNoCredit,
    canDebit: !transactionsBlocked && !postNoDebit,
    transactionsBlocked,
  };
}

function mapCbsErrorToHttpStatus(parsedResponse) {
  const responseCode = String(parsedResponse?.response_code || '').trim();

  if (responseCode === '3001') {
    return 404;
  }

  if (responseCode === '4007' || responseCode === '2012') {
    return 502;
  }

  return 502;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = env.CBS_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(408, 'CBS request timed out');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAuthorizationToken(options = {}) {
  assertCbsTokenConfig();

  const requestId = options.requestId || generateRequestId();
  const sourceApp = options.sourceApp || env.CBS_SOURCE_APP;
  const scope = options.scope || env.CBS_ACCOUNT_INQUIRY_SCOPE;
  const cachedToken = getCachedAuthorizationToken({ sourceApp, scope });

  if (cachedToken) {
    return {
      httpStatus: cachedToken.httpStatus,
      requestId: cachedToken.requestId,
      sourceApp,
      scope,
      payload: cachedToken.payload,
      accessToken: cachedToken.accessToken,
      cached: true,
    };
  }

  const url = buildCbsUrl(env.CBS_AUTH_TOKEN_PATH);
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/x-www-form-urlencoded',
    ...buildCbsApiKeyHeaders(),
  };
  const formBody = new URLSearchParams({
    username: env.CBS_USERNAME,
    password: env.CBS_PASSWORD,
    client_id: env.CBS_CLIENT_ID,
    client_secret: env.CBS_CLIENT_SECRET,
    grant_type: env.CBS_TOKEN_GRANT_TYPE,
    scope,
    source_app: sourceApp,
    request_id: requestId,
  });

  let lastError;

  for (let attempt = 1; attempt <= CBS_TOKEN_MAX_ATTEMPTS; attempt += 1) {
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
        logger.error('CBS token response JSON parse failed', {
          url,
          httpStatus: response.status,
          contentType,
          requestId,
          sourceApp,
          scope,
          attempt,
          responsePreview: buildResponsePreview(responseText),
          parseError: error.message,
        });

        if (attempt < CBS_TOKEN_MAX_ATTEMPTS && shouldRetryTokenResponse({
          responseStatus: response.status,
          responseText,
          contentType,
        })) {
          logger.warn('Retrying CBS token request after non-JSON response', {
            attempt,
            nextAttempt: attempt + 1,
            requestId,
            sourceApp,
            scope,
          });
          await sleep(CBS_TOKEN_RETRY_DELAY_MS);
          continue;
        }

        throw new ApiError(502, 'CBS token response was not valid JSON');
      }

      if (!response.ok || parsedResponse?.response_code !== '0000') {
        const gatewayMessage =
          getFirstNonEmptyValue(parsedResponse, ['response_detail', 'response_description', 'response_message'])
          || `CBS token request failed with HTTP ${response.status}`;
        const apiError = new ApiError(mapCbsErrorToHttpStatus(parsedResponse), `CBS token request failed: ${gatewayMessage}`, [
          { gatewayResponse: parsedResponse },
        ]);

        if (attempt < CBS_TOKEN_MAX_ATTEMPTS && shouldRetryTokenResponse({
          responseStatus: response.status,
          responseText,
          contentType,
        })) {
          logger.warn('Retrying CBS token request after transient gateway failure', {
            attempt,
            nextAttempt: attempt + 1,
            requestId,
            sourceApp,
            scope,
            httpStatus: response.status,
          });
          await sleep(CBS_TOKEN_RETRY_DELAY_MS);
          continue;
        }

        throw apiError;
      }

      const accessToken = parsedResponse?.response_data?.access_token;

      cacheAuthorizationToken({
        sourceApp,
        scope,
        accessToken,
        payload: parsedResponse,
        httpStatus: response.status,
        requestId,
      });

      return {
        httpStatus: response.status,
        requestId,
        sourceApp,
        scope,
        payload: parsedResponse,
        accessToken,
        cached: false,
      };
    } catch (error) {
      lastError = error;

      if (attempt < CBS_TOKEN_MAX_ATTEMPTS && shouldRetryTokenError(error)) {
        logger.warn('Retrying CBS token request after transport or timeout failure', {
          attempt,
          nextAttempt: attempt + 1,
          requestId,
          sourceApp,
          scope,
          errorMessage: error.message,
        });
        await sleep(CBS_TOKEN_RETRY_DELAY_MS);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

async function fetchSigningKey({ accessToken, requestId, sourceApp } = {}) {
  if (!accessToken) {
    throw new ApiError(400, 'CBS access token is required');
  }

  const resolvedRequestId = requestId || generateRequestId();
  const resolvedSourceApp = sourceApp || env.CBS_SOURCE_APP;
  const url = buildCbsUrl(env.CBS_FETCH_KEY_PATH);
  const headers = {
    Accept: 'text/plain, application/json, text/plain; charset=utf-8',
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...buildCbsApiKeyHeaders(),
  };
  const body = {
    request_id: resolvedRequestId,
    source_app: resolvedSourceApp,
  };

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
      throw new ApiError(502, `CBS sign key request failed with HTTP ${response.status}`);
    }

    const gatewayMessage =
      getFirstNonEmptyValue(parsedResponse, ['response_detail', 'response_description', 'response_message'])
      || `CBS sign key request failed with HTTP ${response.status}`;
    throw new ApiError(mapCbsErrorToHttpStatus(parsedResponse), `CBS sign key request failed: ${gatewayMessage}`, [
      { gatewayResponse: parsedResponse },
    ]);
  }

  const trimmedResponse = String(responseText || '').trim();
  if (!trimmedResponse) {
    throw new ApiError(502, 'CBS sign key response was empty');
  }

  if (trimmedResponse.startsWith('{')) {
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(trimmedResponse);
    } catch {
      throw new ApiError(502, 'CBS sign key response was not valid text or JSON');
    }

    const gatewayMessage =
      getFirstNonEmptyValue(parsedResponse, ['response_detail', 'response_description', 'response_message'])
      || 'CBS sign key request did not return a private key';
    throw new ApiError(mapCbsErrorToHttpStatus(parsedResponse), `CBS sign key request failed: ${gatewayMessage}`, [
      { gatewayResponse: parsedResponse },
    ]);
  }

  return {
    requestId: resolvedRequestId,
    sourceApp: resolvedSourceApp,
    privateKeyPem: responseText,
  };
}

function generateSignature({ privateKeyPem, payload, timestamp, nonce } = {}) {
  if (!privateKeyPem) {
    throw new ApiError(400, 'CBS private key is required');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError(400, 'CBS payload must be a JSON object');
  }

  const resolvedTimestamp = timestamp || formatTimestamp();
  const resolvedNonce = nonce || generateRequestId().replace(/-/g, '');
  const canonicalPayload = createCanonicalJsonString(payload);
  const bodyBase64 = Buffer.from(canonicalPayload, 'utf8').toString('base64');
  const expirationTime = Math.floor(Date.now() / 1000) + 120;
  const signaturePayload = {
    nonce: resolvedNonce,
    timestamp: resolvedTimestamp,
    exp: expirationTime,
    data: bodyBase64,
  };
  const signatureJwt = jwt.sign(signaturePayload, privateKeyPem, {
    algorithm: 'RS256',
    noTimestamp: true,
  });

  return {
    timestamp: resolvedTimestamp,
    nonce: resolvedNonce,
    exp: expirationTime,
    canonicalPayload,
    bodyBase64,
    signaturePayload,
    signatureJwt,
    authorizationHeader: `DKSignature ${signatureJwt}`,
  };
}

function buildInquiryPayload(options = {}) {
  const accountNumber = options.accountNumber || options.accountNo;
  const productType = options.productType || inferProductType(accountNumber);

  return {
    account_no: accountNumber,
    request_id: options.requestId || generateRequestId(),
    source_app: options.sourceApp || env.CBS_SOURCE_APP,
    product_type: productType,
    ...(options.channel ? { channel: options.channel } : {}),
  };
}

async function accountInquiry(options = {}) {
  const requestPayload = buildInquiryPayload(options);
  const tokenResult = await fetchAuthorizationToken({
    sourceApp: requestPayload.source_app,
    requestId: requestPayload.request_id,
    scope: env.CBS_ACCOUNT_INQUIRY_SCOPE,
  });
  const accessToken = tokenResult.accessToken || tokenResult?.payload?.response_data?.access_token;

  if (!accessToken) {
    throw new ApiError(502, 'CBS token response did not include an access token');
  }

  const keyResult = await fetchSigningKey({
    accessToken,
    requestId: requestPayload.request_id,
    sourceApp: requestPayload.source_app,
  });
  const signature = generateSignature({
    privateKeyPem: keyResult.privateKeyPem,
    payload: requestPayload,
  });
  const url = buildCbsUrl(env.CBS_ACCOUNT_INQUIRY_PATH);
  const headers = {
    Accept: 'application/json, text/plain, */*',
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'DK-Signature': signature.authorizationHeader,
    'DK-Timestamp': signature.timestamp,
    'DK-Nonce': signature.nonce,
    ...buildCbsApiKeyHeaders(),
  };

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestPayload),
  });

  const responseText = await response.text();
  let parsedResponse;

  try {
    parsedResponse = JSON.parse(responseText);
  } catch {
    throw new ApiError(502, 'CBS account inquiry response was not valid JSON');
  }

  if (!response.ok || parsedResponse?.response_code !== '0000') {
    const gatewayMessage =
      getFirstNonEmptyValue(parsedResponse, ['response_detail', 'response_description', 'response_message'])
      || `CBS account inquiry failed with HTTP ${response.status}`;
    throw new ApiError(mapCbsErrorToHttpStatus(parsedResponse), `CBS account inquiry failed: ${gatewayMessage}`, [
      { gatewayResponse: parsedResponse },
    ]);
  }

  const responseData = parsedResponse.response_data || {};
  const restrictionSummary = buildRestrictionSummary(responseData);

  return {
    httpStatus: response.status,
    requestPayload,
    tokenScope: tokenResult.scope,
    signature: {
      timestamp: signature.timestamp,
      nonce: signature.nonce,
      exp: signature.exp,
    },
    summary: {
      inquiryId: responseData.meta_info?.inquiry_id || null,
      inquiryTimestamp: responseData.meta_info?.inquiry_ts || null,
      inquiryExpiryTimestamp: responseData.meta_info?.expiry_ts || null,
      accountName: responseData.account_info?.account_name || null,
      accountNumber: responseData.account_info?.account_no || requestPayload.account_no,
      productType: responseData.account_status?.product_type || requestPayload.product_type,
      currencyCode: responseData.account_status?.currency_code || null,
      availableBalance: responseData.balance_info?.btn_available_balance || null,
      usdEquivalentAvailableBalance: responseData.balance_info?.usd_equiv_available_bal || null,
      restrictionSummary,
    },
    payload: parsedResponse,
  };
}

async function getIssuerReserveBalance() {
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

  const reserveAccount = issuerBank.accounts.find((account) => account.accountType === 'RESERVE');

  if (!reserveAccount) {
    throw new ApiError(404, `Reserve account is not configured for issuer bank ${issuerBank.name}`);
  }

  const inquiryResult = await accountInquiry({
    accountNumber: reserveAccount.accountNumber,
  });

  return {
    bank: {
      id: issuerBank.id,
      name: issuerBank.name,
      code: issuerBank.code,
      supportsBtn: issuerBank.supportsBtn,
      isIssuer: issuerBank.isIssuer,
    },
    reserveAccount: {
      id: reserveAccount.id,
      accountName: reserveAccount.accountName,
      accountNumber: reserveAccount.accountNumber,
      currency: reserveAccount.currency,
    },
    inquiry: inquiryResult.summary,
    payload: inquiryResult.payload,
  };
}

module.exports = {
  accountInquiry,
  getIssuerReserveBalance,
};
