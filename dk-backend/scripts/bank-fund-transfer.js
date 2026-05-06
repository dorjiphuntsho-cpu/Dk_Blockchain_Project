import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const outputDir = path.resolve("tmp/bank-api");
const inquiryResponsePath = path.join(outputDir, "account-inquiry-response.json");
const args = process.argv.slice(2);
const confirmed = args.includes("--confirm");
const amountArg = args.find((arg) => /^\d+(\.\d+)?$/.test(arg));
const amount = Number(amountArg || 10).toFixed(2);

const requiredEnv = [
  "BANK_API_BASE_URL",
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
  "BANK_SOURCE_ACCOUNT_NAME",
  "BANK_SOURCE_ACCOUNT_NUMBER",
];

const transferUrl =
  process.env.BANK_FUND_TRANSFER_URL ||
  process.env.BANK_INITIATE_TRANSACTION_URL ||
  `${process.env.BANK_API_BASE_URL}/v1/initiate/transaction`;

const redact = (value, visibleStart = 8, visibleEnd = 6) => {
  if (!value) return "";
  if (value.length <= visibleStart + visibleEnd) return "***";
  return `${value.slice(0, visibleStart)}...${value.slice(-visibleEnd)}`;
};

const redactName = (value) => {
  if (!value) return "";
  const [firstName = ""] = String(value).trim().split(/\s+/);
  return firstName ? `${firstName[0]}***` : "***";
};

const readJson = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const readJsonFile = async (filePath) => {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
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
    source_app: process.env.BANK_AUTH_SOURCE_APP,
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

const inquiryData = await readJsonFile(inquiryResponsePath);
const inquiry = inquiryData?.response_data || {};
const inquiryId = inquiry.inquiry_id;
const beneficiaryAccount =
  inquiry.beneficiary_account_number ||
  inquiry.account_number ||
  process.env.BANK_TEST_BENEFICIARY_ACCOUNT;
const beneficiaryName =
  inquiry.beneficiary_account_name ||
  inquiry.account_name ||
  process.env.BANK_TEST_BENEFICIARY_NAME;
const beneficiaryBankCode =
  inquiry.bene_bank_code ||
  inquiry.bank_code ||
  process.env.BANK_BENE_BANK_CODE;

if (!inquiryId || !beneficiaryAccount || !beneficiaryName || !beneficiaryBankCode) {
  await fail("Missing inquiry result data. Run npm run bank:inquiry first, or set beneficiary env values.", {
    needs: ["inquiry_id", "beneficiary account", "beneficiary name", "beneficiary bank code"],
    source: "tmp/bank-api/account-inquiry-response.json",
  });
}

const requestId = `DKT-${Date.now()}`;
const transferBody = {
  request_id: `${requestId}-TRF`,
  inquiry_id: inquiryId,
  transaction_datetime: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  source_app: process.env.BANK_AUTH_SOURCE_APP,
  transaction_amount: Number(amount),
  currency: "BTN",
  payment_type: "INTRA",
  source_account_name: process.env.BANK_SOURCE_ACCOUNT_NAME,
  source_account_number: process.env.BANK_SOURCE_ACCOUNT_NUMBER,
  bene_cust_name: beneficiaryName,
  bene_account_number: beneficiaryAccount,
  bene_bank_code: beneficiaryBankCode,
  narration: `DKT settlement transfer ${requestId}`,
};

await writeJson("fund-transfer-request-preview.json", {
  ...transferBody,
  source_account_name: redactName(transferBody.source_account_name),
  source_account_number: redact(transferBody.source_account_number, 4, 4),
  bene_cust_name: redactName(transferBody.bene_cust_name),
  bene_account_number: redact(transferBody.bene_account_number, 4, 4),
});

if (!confirmed) {
  await fail("Fund transfer not sent. Re-run with --confirm after reviewing tmp/bank-api/fund-transfer-request-preview.json.", {
    command: `npm run bank:transfer -- --confirm ${amount}`,
  });
}

const gatewayHeaders = {
  [process.env.BANK_GATEWAY_API_KEY_HEADER]: process.env.BANK_GATEWAY_API_KEY,
};

console.log("1. Fetching authorization token...");

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

const authResponse = await fetch(process.env.BANK_AUTH_TOKEN_URL, {
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
  await writeJson("fund-transfer-auth-error.json", authData);
  await fail("Authorization token request did not return access_token", {
    httpStatus: authResponse.status,
    savedTo: "tmp/bank-api/fund-transfer-auth-error.json",
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

if (!signKeyResponse.ok || !signKey) {
  await writeJson("fund-transfer-sign-key-error.json", signKeyData);
  await fail("Sign key request did not return a key", {
    httpStatus: signKeyResponse.status,
    savedTo: "tmp/bank-api/fund-transfer-sign-key-error.json",
  });
}

console.log(`   OK key=${redact(signKey.replaceAll("\n", ""), 18, 12)}`);
console.log("3. Initiating intra-bank fund transfer...");

const transferResponse = await fetch(transferUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...gatewayHeaders,
    ...buildDkSignatureHeaders(transferBody, signKey),
  },
  body: canonicalJson(transferBody),
});
const transferData = await readJson(transferResponse);
await writeJson("fund-transfer-response.json", transferData);

if (!transferResponse.ok || transferData.response_code && transferData.response_code !== "0000") {
  await fail("Fund transfer failed", {
    httpStatus: transferResponse.status,
    response_code: transferData.response_code,
    response_detail:
      transferData.response_detail ||
      transferData.response_message ||
      transferData.response_description ||
      transferData.message,
    savedTo: "tmp/bank-api/fund-transfer-response.json",
  });
}

console.log(`   OK response_code=${transferData.response_code || "HTTP_200"}`);
console.log("Done. Fund transfer response saved under tmp/bank-api/fund-transfer-response.json.");
