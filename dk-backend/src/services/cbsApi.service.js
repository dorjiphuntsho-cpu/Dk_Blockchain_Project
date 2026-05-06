import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const CBS_BASE_URL = process.env.CBS_BASE_URL;
const CBS_AUTH_TOKEN_URL =
  process.env.CBS_AUTH_TOKEN_URL || `${CBS_BASE_URL}/v1/auth/token`;
const CBS_SIGN_KEY_URL = process.env.CBS_SIGN_KEY_URL || `${CBS_BASE_URL}/v1/sign/key`;
const CBS_ACCOUNT_INQUIRY_URL =
  process.env.CBS_ACCOUNT_INQUIRY_URL || `${CBS_BASE_URL}/v1/acc/inquiry`;
const CBS_API_KEY_HEADER = process.env.CBS_API_KEY_HEADER || "X-gravitee-api-key";
const CBS_API_KEY = process.env.CBS_API_KEY;
const CBS_USERNAME = process.env.CBS_USERNAME;
const CBS_PASSWORD = process.env.CBS_PASSWORD;
const CBS_CLIENT_ID = process.env.CBS_CLIENT_ID;
const CBS_CLIENT_SECRET = process.env.CBS_CLIENT_SECRET;
const CBS_GRANT_TYPE = process.env.CBS_GRANT_TYPE || "password";
const CBS_SCOPES = process.env.CBS_SCOPES || "keys:read accounts:read";
const CBS_SOURCE_APP = process.env.CBS_SOURCE_APP || "SRC_APP_0801";

let cachedToken = null;
let cachedTokenExpiresAt = 0;
let cachedSignKey = null;

const requiredEnv = [
  ["CBS_BASE_URL", CBS_BASE_URL],
  ["CBS_API_KEY", CBS_API_KEY],
  ["CBS_USERNAME", CBS_USERNAME],
  ["CBS_PASSWORD", CBS_PASSWORD],
  ["CBS_CLIENT_ID", CBS_CLIENT_ID],
  ["CBS_CLIENT_SECRET", CBS_CLIENT_SECRET],
];

const buildRequestId = (suffix) => {
  return `CBS-${Date.now()}-${suffix}`;
};

const gatewayHeaders = (headers = {}) => ({
  ...headers,
  [CBS_API_KEY_HEADER]: CBS_API_KEY,
});

const readJson = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

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
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bodyBase64 = Buffer.from(canonicalJson(body)).toString("base64");
  const signature = signJwtWithPrivateKey(
    {
      data: bodyBase64,
      timestamp,
      nonce,
      iat: nowSeconds,
      exp: nowSeconds + 300,
    },
    privateKeyPem
  );

  return {
    "DK-Signature": `DKSignature ${signature}`,
    "DK-Timestamp": timestamp,
    "DK-Nonce": nonce,
    source_app: CBS_SOURCE_APP,
  };
};

const extractSignKey = (data) => {
  const key =
    data?.response_data?.rsa_key ||
    data?.response_data?.public_key ||
    data?.response_data?.key ||
    data?.rsa_key ||
    data?.public_key ||
    data?.key ||
    data?.raw;

  if (!key || typeof key !== "string") {
    return null;
  }

  return key.includes("-----BEGIN") ? key.trim() : key;
};

const assertConfig = () => {
  const missing = requiredEnv.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing CBS env vars: ${missing.join(", ")}`);
  }
};

const fetchAuthorizationToken = async (signal) => {
  const now = Date.now();
  if (cachedToken && cachedTokenExpiresAt > now + 30_000) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    username: CBS_USERNAME,
    password: CBS_PASSWORD,
    client_id: CBS_CLIENT_ID,
    client_secret: CBS_CLIENT_SECRET,
    grant_type: CBS_GRANT_TYPE,
    scope: CBS_SCOPES,
    source_app: CBS_SOURCE_APP,
    request_id: buildRequestId("AUTH"),
  });

  const response = await fetch(CBS_AUTH_TOKEN_URL, {
    method: "POST",
    headers: gatewayHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
    }),
    body,
    signal,
  });
  const data = await readJson(response);

  if (!response.ok || data?.response_code && data.response_code !== "0000") {
    throw new Error(
      data?.response_detail ||
      data?.response_message ||
      data?.message ||
      `CBS auth failed with status ${response.status}`
    );
  }

  const token = data?.access_token || data?.token || data?.response_data?.access_token;
  if (!token) {
    throw new Error("CBS auth response did not include access_token");
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

  const response = await fetch(CBS_SIGN_KEY_URL, {
    method: "POST",
    headers: gatewayHeaders({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    }),
    body: JSON.stringify({
      request_id: buildRequestId("SIGN"),
      source_app: CBS_SOURCE_APP,
    }),
    signal,
  });
  const data = await readJson(response);

  if (!response.ok || data?.response_code && data.response_code !== "0000") {
    throw new Error(
      data?.response_detail ||
      data?.response_message ||
      data?.message ||
      `CBS sign key failed with status ${response.status}`
    );
  }

  const signKey = extractSignKey(data);
  if (!signKey) {
    throw new Error("CBS sign key response did not include a key");
  }

  cachedSignKey = signKey;
  return signKey;
};

export const inquireCbsAccount = async ({
  accountNo,
  productType = "LCY_ACC",
  signal,
}) => {
  assertConfig();

  const accessToken = await fetchAuthorizationToken(signal);
  const signKey = await fetchSignKey(accessToken, signal);
  const body = {
    account_no: accountNo,
    request_id: buildRequestId("ACC"),
    source_app: CBS_SOURCE_APP,
    product_type: productType,
  };

  const response = await fetch(CBS_ACCOUNT_INQUIRY_URL, {
    method: "POST",
    headers: gatewayHeaders({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...buildDkSignatureHeaders(body, signKey),
    }),
    body: canonicalJson(body),
    signal,
  });
  const data = await readJson(response);

  if (!response.ok || data?.response_code && data.response_code !== "0000") {
    throw new Error(
      data?.response_detail ||
      data?.response_message ||
      data?.response_description ||
      data?.message ||
      `CBS account inquiry failed with status ${response.status}`
    );
  }

  return data;
};
