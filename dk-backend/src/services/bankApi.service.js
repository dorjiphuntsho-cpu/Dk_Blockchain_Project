import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const BANK_API_BASE_URL = process.env.BANK_API_BASE_URL || "http://localhost:5000/mock-bank";
const BANK_AUTH_TOKEN_URL =
  process.env.BANK_AUTH_TOKEN_URL || `${BANK_API_BASE_URL}/v1/auth/token`;
const BANK_SIGN_KEY_URL = process.env.BANK_SIGN_KEY_URL || `${BANK_API_BASE_URL}/v1/sign/key`;
const BANK_FUND_TRANSFER_URL =
  process.env.BANK_FUND_TRANSFER_URL ||
  process.env.BANK_INITIATE_TRANSACTION_URL ||
  `${BANK_API_BASE_URL}/v1/initiate/transaction`;
const BANK_TRANSACTION_STATUS_URL =
  process.env.BANK_TRANSACTION_STATUS_URL ||
  process.env.BANK_CURRENT_TRANSACTION_STATUS_URL ||
  `${BANK_API_BASE_URL}/v1/transaction/status`;
const BANK_ACCOUNT_INQUIRY_URL =
  process.env.BANK_ACCOUNT_INQUIRY_URL ||
  `${BANK_API_BASE_URL}/v1/beneficiary/account_inquiry`;
const BANK_API_TIMEOUT_MS = Number(process.env.BANK_API_TIMEOUT_MS || 8000);
const BANK_GATEWAY_API_KEY_HEADER = process.env.BANK_GATEWAY_API_KEY_HEADER || "x-api-key";
const BANK_GATEWAY_API_KEY = process.env.BANK_GATEWAY_API_KEY;
const BANK_BENE_BANK_CODE = process.env.BANK_BENE_BANK_CODE || "1060";
const BANK_SOURCE_ACCOUNT_NAME = process.env.BANK_SOURCE_ACCOUNT_NAME;
const BANK_SOURCE_ACCOUNT_NUMBER = process.env.BANK_SOURCE_ACCOUNT_NUMBER;
const BANK_AUTH_USERNAME = process.env.BANK_AUTH_USERNAME;
const BANK_AUTH_PASSWORD = process.env.BANK_AUTH_PASSWORD;
const BANK_AUTH_CLIENT_ID = process.env.BANK_AUTH_CLIENT_ID;
const BANK_AUTH_CLIENT_SECRET = process.env.BANK_AUTH_CLIENT_SECRET;
const BANK_AUTH_GRANT_TYPE = process.env.BANK_AUTH_GRANT_TYPE || "password";
const BANK_AUTH_SCOPES = process.env.BANK_AUTH_SCOPES || "keys:read";
const BANK_AUTH_SOURCE_APP = process.env.BANK_AUTH_SOURCE_APP || "SRC_APP_0201";

let cachedToken = null;
let cachedTokenExpiresAt = 0;
let cachedSignKey = null;

const toBase64UrlJson = (value) => {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
};

const sortJsonValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortJsonValue(value[key]);
        return sorted;
      }, {});
  }

  return value;
};

const canonicalJson = (value) => {
  return JSON.stringify(sortJsonValue(value));
};

const buildUtcTimestamp = () => {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
};

const buildNonce = () => {
  return crypto.randomUUID().replaceAll("-", "");
};

const signJwtWithPrivateKey = (payload, privateKeyPem) => {
  const encodedHeader = toBase64UrlJson({ alg: "RS256", typ: "JWT" });
  const encodedPayload = toBase64UrlJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKeyPem, "base64url");

  return `${signingInput}.${signature}`;
};

const buildDkSignatureHeaders = (body, privateKeyPem) => {
  const timestamp = buildUtcTimestamp();
  const nonce = buildNonce();
  const bodyBase64 = Buffer.from(canonicalJson(body)).toString("base64");
  const signature = signJwtWithPrivateKey(
    {
      data: bodyBase64,
      timestamp,
      nonce,
    },
    privateKeyPem
  );

  return {
    "DK-Signature": `DKSignature ${signature}`,
    "DK-Timestamp": timestamp,
    "DK-Nonce": nonce,
    source_app: BANK_AUTH_SOURCE_APP,
  };
};

const withGatewayHeaders = (headers = {}) => ({
  ...headers,
  ...(BANK_GATEWAY_API_KEY
    ? { [BANK_GATEWAY_API_KEY_HEADER]: BANK_GATEWAY_API_KEY }
    : {}),
});

const buildRequestId = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 12);
  return `DKT-${date}-${random}`;
};

const normalizeBankApiResponse = (data) => ({
  status:
    data?.status ||
    data?.transaction_status ||
    data?.payment_status ||
    (data?.response_code === "0000" ? "SUCCESS" : data?.response_code) ||
    "SUCCESS",
  reference:
    data?.reference ||
    data?.bank_reference ||
    data?.transaction_reference ||
    data?.response_data?.txn_status_id ||
    data?.response_data?.transaction_id ||
    data?.response_data?.transaction_reference ||
    data?.response_data?.reference_no ||
    data?.response_data?.inquiry_id ||
    data?.request_id ||
    null,
  message:
    data?.message ||
    data?.status_message ||
    data?.response_message ||
    data?.response_description ||
    "Bank payout completed",
});

const isBankSuccess = (status) => {
  if (!status) return true;
  return ["SUCCESS", "SUCCEEDED", "COMPLETED", "APPROVED", "00", "000", "0000"].includes(
    String(status).toUpperCase()
  );
};

const extractBankIds = (data) => ({
  inquiryId:
    data?.response_data?.inquiry_id ||
    data?.inquiry_id ||
    null,
  transactionId:
    data?.response_data?.txn_status_id ||
    data?.response_data?.transaction_id ||
    data?.response_data?.transaction_reference ||
    data?.txn_status_id ||
    data?.transaction_id ||
    data?.transaction_reference ||
    null,
});

const postBankApi = async (url, body, signal) => {
  const accessToken = await fetchAuthorizationToken(signal);
  const signKey = await fetchSignKey(accessToken, signal);
  const requestBody = canonicalJson(body);
  const signatureHeaders = buildDkSignatureHeaders(body, signKey);

  const response = await fetch(url, {
    method: "POST",
    headers: withGatewayHeaders({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...signatureHeaders,
    }),
    body: requestBody,
    signal,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: data?.status || "FAILED",
      reference: data?.reference || data?.request_id || body.request_id || null,
      message: data?.message || `Bank API failed with status ${response.status}`,
      data,
    };
  }

  const normalized = normalizeBankApiResponse({
    ...data,
    request_id: data?.request_id || body.request_id,
  });

  return {
    ok: isBankSuccess(normalized.status),
    ...normalized,
    ...extractBankIds(data),
    data,
  };
};

const fetchAuthorizationToken = async (signal) => {
  const now = Date.now();
  if (cachedToken && cachedTokenExpiresAt > now + 30_000) {
    return cachedToken;
  }

  const missing = [
    ["BANK_AUTH_USERNAME", BANK_AUTH_USERNAME],
    ["BANK_AUTH_PASSWORD", BANK_AUTH_PASSWORD],
    ["BANK_AUTH_CLIENT_ID", BANK_AUTH_CLIENT_ID],
    ["BANK_AUTH_CLIENT_SECRET", BANK_AUTH_CLIENT_SECRET],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing bank auth env vars: ${missing.join(", ")}`);
  }

  const requestId = buildRequestId();
  const body = new URLSearchParams({
    username: BANK_AUTH_USERNAME,
    password: BANK_AUTH_PASSWORD,
    client_id: BANK_AUTH_CLIENT_ID,
    client_secret: BANK_AUTH_CLIENT_SECRET,
    grant_type: BANK_AUTH_GRANT_TYPE,
    scopes: BANK_AUTH_SCOPES,
    source_app: BANK_AUTH_SOURCE_APP,
    request_id: requestId,
  });

  const response = await fetch(BANK_AUTH_TOKEN_URL, {
    method: "POST",
    headers: withGatewayHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
    }),
    body,
    signal,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || data?.error_description || `Bank auth failed with status ${response.status}`);
  }

  const token = data?.access_token || data?.token || data?.response_data?.access_token;
  if (!token) {
    throw new Error("Bank auth response did not include access_token");
  }

  const expiresInSeconds = Number(data?.expires_in || data?.response_data?.expires_in || 300);
  cachedToken = token;
  cachedTokenExpiresAt = now + expiresInSeconds * 1000;

  return token;
};

const fetchSignKey = async (accessToken, signal) => {
  if (cachedSignKey) {
    return cachedSignKey;
  }

  const response = await fetch(BANK_SIGN_KEY_URL, {
    method: "POST",
    headers: withGatewayHeaders({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    }),
    body: JSON.stringify({
      request_id: buildRequestId(),
      source_app: BANK_AUTH_SOURCE_APP,
    }),
    signal,
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok || data?.response_code && data.response_code !== "0000") {
    throw new Error(
      data?.response_message ||
      data?.response_detail ||
      data?.message ||
      `Bank sign key failed with status ${response.status}`
    );
  }

  const signKey =
    data?.response_data?.rsa_key ||
    data?.response_data?.public_key ||
    data?.response_data?.key ||
    data?.rsa_key ||
    data?.public_key ||
    data?.key ||
    data?.raw;

  if (!signKey) {
    throw new Error("Bank sign key response did not include a key");
  }

  cachedSignKey = signKey;
  return signKey;
};

export const sendFiatPayout = async ({
  fromBank,
  receiverName,
  receiverAccount,
  amount,
  currency,
}) => {
  if (!receiverName || !receiverAccount) {
    return {
      status: "FAILED",
      reference: null,
      message: "Receiver name and account are required",
    };
  }

  if (!BANK_SOURCE_ACCOUNT_NUMBER) {
    return {
      status: "FAILED",
      reference: null,
      message: "BANK_SOURCE_ACCOUNT_NUMBER is not set",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BANK_API_TIMEOUT_MS);
  const requestId = buildRequestId();
  const inquiryBody = {
    request_id: `${requestId}-INQ`,
    amount: Number(amount).toFixed(2),
    currency,
    bene_bank_code: BANK_BENE_BANK_CODE,
    bene_account_number: receiverAccount,
    source_account_name: BANK_SOURCE_ACCOUNT_NAME || fromBank.name,
    soure_account_number: BANK_SOURCE_ACCOUNT_NUMBER,
  };
  const payoutBody = {
    request_id: `${requestId}-TRF`,
    inquiry_id: null,
    transaction_datetime: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    source_app: BANK_AUTH_SOURCE_APP,
    transaction_amount: Number(Number(amount).toFixed(2)),
    currency,
    payment_type: "INTRA",
    source_account_name: BANK_SOURCE_ACCOUNT_NAME || fromBank.name,
    source_account_number: BANK_SOURCE_ACCOUNT_NUMBER,
    bene_cust_name: receiverName,
    bene_account_number: receiverAccount,
    bene_bank_code: BANK_BENE_BANK_CODE,
    narration: `DKT settlement transfer ${requestId}`,
  };

  try {
    const inquiryResult = await postBankApi(
      BANK_ACCOUNT_INQUIRY_URL,
      inquiryBody,
      controller.signal
    );

    if (!inquiryResult.ok) {
      return {
        status: inquiryResult.status || "FAILED",
        reference: inquiryResult.reference,
        inquiryId: inquiryResult.inquiryId,
        transactionId: null,
        message: `Beneficiary account inquiry failed: ${inquiryResult.message}`,
        data: inquiryResult.data,
      };
    }

    const payoutResult = await postBankApi(
      BANK_FUND_TRANSFER_URL,
      {
        ...payoutBody,
        inquiry_id: inquiryResult.inquiryId,
        bene_cust_name:
          inquiryResult.data?.response_data?.beneficiary_account_name ||
          inquiryResult.data?.response_data?.account_name ||
          receiverName,
      },
      controller.signal
    );

    if (!payoutResult.ok) {
      return {
        status: payoutResult.status || "FAILED",
        reference: payoutResult.reference || requestId,
        inquiryId: inquiryResult.inquiryId,
        transactionId: payoutResult.transactionId,
        message: payoutResult.message,
        data: payoutResult.data,
      };
    }

    return {
      ...payoutResult,
      inquiryId: inquiryResult.inquiryId,
      transactionId: payoutResult.transactionId,
    };
  } catch (err) {
    return {
      status: "FAILED",
      reference: requestId,
      inquiryId: null,
      transactionId: null,
      message: err.name === "AbortError" ? "Bank API request timed out" : err.message,
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const checkFiatPayoutStatus = async ({
  transactionId,
  receiverAccount,
}) => {
  if (!transactionId || !receiverAccount) {
    return {
      status: "FAILED",
      reference: transactionId || null,
      message: "transactionId and receiverAccount are required",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BANK_API_TIMEOUT_MS);
  const requestId = buildRequestId();

  try {
    const statusResult = await postBankApi(
      BANK_TRANSACTION_STATUS_URL,
      {
        request_id: `${requestId}-STS`,
        transaction_id: transactionId,
        bene_account_number: receiverAccount,
      },
      controller.signal
    );

    return {
      ...statusResult,
      transactionId,
    };
  } catch (err) {
    return {
      status: "FAILED",
      reference: transactionId,
      transactionId,
      message: err.name === "AbortError" ? "Bank status request timed out" : err.message,
    };
  } finally {
    clearTimeout(timeout);
  }
};
