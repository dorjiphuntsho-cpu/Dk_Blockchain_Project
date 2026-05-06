import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const outputDir = path.resolve("tmp/bank-api");
const args = process.argv.slice(2);

const requiredEnv = [
  "CBS_BASE_URL",
  "CBS_API_KEY",
  "CBS_USERNAME",
  "CBS_PASSWORD",
  "CBS_CLIENT_ID",
  "CBS_CLIENT_SECRET",
  "CBS_SOURCE_APP",
];

const cbsBaseUrl = process.env.CBS_BASE_URL;
const authTokenUrl = process.env.CBS_AUTH_TOKEN_URL || `${cbsBaseUrl}/v1/auth/token`;
const signKeyUrl = process.env.CBS_SIGN_KEY_URL || `${cbsBaseUrl}/v1/sign/key`;
const accountInquiryUrl =
  process.env.CBS_ACCOUNT_INQUIRY_URL || `${cbsBaseUrl}/v1/acc/inquiry`;
const apiKeyHeader = process.env.CBS_API_KEY_HEADER || "X-gravitee-api-key";
const accountNo = args[0] || process.env.CBS_TEST_ACCOUNT_NO;
const productType = args[1] || process.env.CBS_PRODUCT_TYPE || "LCY_ACC";

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

const fail = async (message, data = null) => {
  console.error(`\nFAILED: ${message}`);
  if (data) {
    console.error(JSON.stringify(data, null, 2));
  }
  process.exit(1);
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
    source_app: process.env.CBS_SOURCE_APP,
  };
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

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  await fail(`Missing env vars: ${missing.join(", ")}`);
}

if (!accountNo) {
  await fail("Missing account number. Pass it as an argument or set CBS_TEST_ACCOUNT_NO.", {
    usage: "npm run cbs:inquiry -- 100100365856",
  });
}

const gatewayHeaders = {
  [apiKeyHeader]: process.env.CBS_API_KEY,
};
const requestId = `CBS-${Date.now()}`;

console.log("1. Fetching CBS authorization token...");

const authBody = new URLSearchParams({
  username: process.env.CBS_USERNAME,
  password: process.env.CBS_PASSWORD,
  client_id: process.env.CBS_CLIENT_ID,
  client_secret: process.env.CBS_CLIENT_SECRET,
  grant_type: process.env.CBS_GRANT_TYPE || "password",
  scope: process.env.CBS_SCOPES || "keys:read",
  source_app: process.env.CBS_SOURCE_APP,
  request_id: requestId,
});

const authResponse = await fetch(authTokenUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    ...gatewayHeaders,
  },
  body: authBody,
});
const authData = await readJson(authResponse);
const accessToken =
  authData.access_token || authData.token || authData.response_data?.access_token;

if (!authResponse.ok || !accessToken) {
  await writeJson("cbs-account-inquiry-auth-error.json", authData);
  await fail("CBS authorization token request did not return access_token", {
    httpStatus: authResponse.status,
    savedTo: "tmp/bank-api/cbs-account-inquiry-auth-error.json",
  });
}

console.log(`   OK token=${redact(accessToken)}`);
console.log("2. Fetching CBS sign key...");

const signKeyResponse = await fetch(signKeyUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...gatewayHeaders,
  },
  body: JSON.stringify({
    request_id: `${requestId}-SIGN`,
    source_app: process.env.CBS_SOURCE_APP,
  }),
});
const signKeyData = await readJson(signKeyResponse);
const signKey = extractSignKey(signKeyData);

if (!signKeyResponse.ok || !signKey) {
  await writeJson("cbs-account-inquiry-sign-key-error.json", signKeyData);
  await fail("CBS sign key request did not return a key", {
    httpStatus: signKeyResponse.status,
    savedTo: "tmp/bank-api/cbs-account-inquiry-sign-key-error.json",
  });
}

console.log(`   OK key=${redact(signKey.replaceAll("\n", ""), 18, 12)}`);
console.log("3. Calling CBS account inquiry...");

const inquiryBody = {
  account_no: accountNo,
  request_id: `${requestId}-ACC`,
  source_app: process.env.CBS_SOURCE_APP,
  product_type: productType,
};

await writeJson("cbs-account-inquiry-request-preview.json", {
  ...inquiryBody,
  account_no: redact(inquiryBody.account_no, 4, 4),
});

const inquiryResponse = await fetch(accountInquiryUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...gatewayHeaders,
    ...buildDkSignatureHeaders(inquiryBody, signKey),
  },
  body: canonicalJson(inquiryBody),
});
const inquiryData = await readJson(inquiryResponse);
await writeJson("cbs-account-inquiry-response.json", inquiryData);

if (!inquiryResponse.ok || inquiryData.response_code && inquiryData.response_code !== "0000") {
  await fail("CBS account inquiry failed", {
    httpStatus: inquiryResponse.status,
    response_code: inquiryData.response_code,
    response_detail:
      inquiryData.response_detail ||
      inquiryData.response_message ||
      inquiryData.response_description ||
      inquiryData.message,
    savedTo: "tmp/bank-api/cbs-account-inquiry-response.json",
  });
}

console.log(`   OK response_code=${inquiryData.response_code || "HTTP_200"}`);
console.log("Done. CBS account inquiry response saved under tmp/bank-api/cbs-account-inquiry-response.json.");
