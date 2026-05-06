import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const outputDir = path.resolve("tmp/bank-api");

const requiredEnv = [
  "BANK_AUTH_TOKEN_URL",
  "BANK_SIGN_KEY_URL",
  "BANK_GATEWAY_API_KEY_HEADER",
  "BANK_GATEWAY_API_KEY",
  "BANK_AUTH_USERNAME",
  "BANK_AUTH_PASSWORD",
  "BANK_AUTH_CLIENT_ID",
  "BANK_AUTH_CLIENT_SECRET",
  "BANK_AUTH_GRANT_TYPE",
  "BANK_AUTH_SCOPES",
  "BANK_AUTH_SOURCE_APP",
];

const redact = (value, visibleStart = 8, visibleEnd = 6) => {
  if (!value) return "";
  if (value.length <= visibleStart + visibleEnd) return "***";
  return `${value.slice(0, visibleStart)}...${value.slice(-visibleEnd)}`;
};

const readJson = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const writeJson = async (fileName, data) => {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, fileName),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8"
  );
};

const extractSignKey = (data) => {
  const key =
    data.response_data?.rsa_key ||
    data.response_data?.public_key ||
    data.response_data?.key ||
    data.rsa_key ||
    data.public_key ||
    data.key ||
    data.raw;

  if (!key || typeof key !== "string") {
    return null;
  }

  return key.includes("-----BEGIN") ? key.trim() : key;
};

const summarizeSignKeyResponse = (data, signKey) => ({
  response_code: data.response_code || null,
  response_message: data.response_message || null,
  response_detail: data.response_detail || null,
  key_format: signKey?.includes("-----BEGIN") ? "PEM" : "unknown",
  key_preview: signKey ? redact(signKey.replaceAll("\n", ""), 18, 12) : null,
});

const fail = async (message, data = null) => {
  console.error(`\nFAILED: ${message}`);
  if (data) {
    console.error(JSON.stringify(data, null, 2));
  }
  process.exit(1);
};

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  await fail(`Missing env vars: ${missing.join(", ")}`);
}

const gatewayHeaders = {
  [process.env.BANK_GATEWAY_API_KEY_HEADER]: process.env.BANK_GATEWAY_API_KEY,
};

const requestId = `DKT-${Date.now()}`;
const authBody = new URLSearchParams({
  username: process.env.BANK_AUTH_USERNAME,
  password: process.env.BANK_AUTH_PASSWORD,
  client_id: process.env.BANK_AUTH_CLIENT_ID,
  client_secret: process.env.BANK_AUTH_CLIENT_SECRET,
  grant_type: process.env.BANK_AUTH_GRANT_TYPE,
  scopes: process.env.BANK_AUTH_SCOPES,
  source_app: process.env.BANK_AUTH_SOURCE_APP,
  request_id: requestId,
});

console.log("1. Fetching authorization token...");

const authResponse = await fetch(process.env.BANK_AUTH_TOKEN_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    ...gatewayHeaders,
  },
  body: authBody,
});

const authData = await readJson(authResponse);
await writeJson("auth-token-response.json", authData);

const accessToken =
  authData.access_token || authData.token || authData.response_data?.access_token;

if (!authResponse.ok || !accessToken) {
  await fail("Authorization token request did not return access_token", {
    httpStatus: authResponse.status,
    response_code: authData.response_code,
    response_detail:
      authData.response_detail ||
      authData.response_message ||
      authData.error_description ||
      authData.message,
    rawResponseSavedTo: "tmp/bank-api/auth-token-response.json",
  });
}

console.log(`   OK token=${redact(accessToken)}`);
console.log("2. Fetching sign key...");

const signKeyResponse = await fetch(process.env.BANK_SIGN_KEY_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...gatewayHeaders,
  },
  body: JSON.stringify({
    request_id: `${requestId}-SIGN`,
    source_app: process.env.BANK_AUTH_SOURCE_APP,
  }),
});

const signKeyData = await readJson(signKeyResponse);
const signKey = extractSignKey(signKeyData);

await writeJson("sign-key-response.json", summarizeSignKeyResponse(signKeyData, signKey));

if (!signKeyResponse.ok || !signKey) {
  await fail("Sign key request did not return a key", {
    httpStatus: signKeyResponse.status,
    response_code: signKeyData.response_code,
    response_detail:
      signKeyData.response_detail ||
      signKeyData.response_message ||
      signKeyData.error_description ||
      signKeyData.message,
    rawResponseSavedTo: "tmp/bank-api/sign-key-response.json",
  });
}

console.log(`   OK key=${redact(signKey.replaceAll("\n", ""), 18, 12)}`);
console.log("\nDone. Redacted responses saved under tmp/bank-api/.");
