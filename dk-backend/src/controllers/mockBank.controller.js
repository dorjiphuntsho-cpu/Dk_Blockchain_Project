import crypto from "node:crypto";

const TOKEN_TTL_SECONDS = 300;
const DEFAULT_MOCK_RSA_KEY =
  "-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALocalMockBankSignKeyForDevelopmentOnly\n-----END PUBLIC KEY-----";

const buildReference = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.floor(100000 + Math.random() * 900000);
  return `MOCK-BANK-${date}-${random}`;
};

const getMockTokenSecret = () => {
  return process.env.MOCK_BANK_TOKEN_SECRET || process.env.BANK_AUTH_CLIENT_SECRET || "local-mock-bank-token-secret";
};

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
};

const encodeBase64UrlJson = (value) => {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
};

const signTokenPayload = (payload) => {
  return crypto
    .createHmac("sha256", getMockTokenSecret())
    .update(payload)
    .digest("base64url");
};

const createAccessToken = ({ scope }) => {
  const payload = encodeBase64UrlJson({
    typ: "mock-bank-access-token",
    scope,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomUUID(),
  });
  const signature = signTokenPayload(payload);
  return `${payload}.${signature}`;
};

const isAccessTokenValid = (token) => {
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = signTokenPayload(payload);
  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  ) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.typ === "mock-bank-access-token" && decoded.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
};

const requireAccessToken = (req, res) => {
  const token = getBearerToken(req);
  if (!token || !isAccessTokenValid(token)) {
    res.status(401).json({
      response_code: "401",
      response_message: "Unauthorized",
    });
    return false;
  }

  return true;
};

export const createMockAuthToken = (req, res) => {
  const scope = req.body?.scopes || req.body?.scope || "keys:read";
  const token = createAccessToken({ scope });

  res.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: TOKEN_TTL_SECONDS,
    scope,
    response_code: "0000",
    response_message: "Success",
  });
};

export const getMockSignKey = (req, res) => {
  if (!requireAccessToken(req, res)) {
    return;
  }

  const rsaKey = process.env.MOCK_BANK_SIGN_KEY || DEFAULT_MOCK_RSA_KEY;

  res.json({
    response_code: "0000",
    response_message: "Success",
    response_data: {
      rsa_key: rsaKey,
      public_key: rsaKey,
      key_id: "mock-sign-key",
    },
  });
};

export const createMockAccountInquiry = (req, res) => {
  if (!requireAccessToken(req, res)) {
    return;
  }

  const {
    request_id: requestId,
    bene_account_number: accountNumber,
    amount,
    currency = "BTN",
  } = req.body;

  if (!accountNumber) {
    return res.status(400).json({
      response_code: "400",
      response_message: "bene_account_number is required",
    });
  }

  res.json({
    response_code: "0000",
    response_message: "Success",
    response_data: {
      inquiry_id: requestId || buildReference(),
      account_name: `Mock Beneficiary ${String(accountNumber).slice(-4)}`,
      account_number: accountNumber,
      amount,
      currency,
    },
  });
};

export const createMockPayout = async (req, res) => {
  const {
    fromBankName,
    receiverName,
    receiverAccount,
    amount,
    currency = "BTN",
  } = req.body;
  const parsedAmount = Number(amount);

  if (!fromBankName || !receiverName || !receiverAccount || amount === undefined) {
    return res.status(400).json({
      status: "FAILED",
      reference: null,
      message: "fromBankName, receiverName, receiverAccount and amount are required",
    });
  }

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({
      status: "FAILED",
      reference: null,
      message: "amount must be a positive number",
    });
  }

  res.json({
    status: "SUCCESS",
    reference: buildReference(),
    message: `${currency} ${parsedAmount} sent from ${fromBankName} to ${receiverName}`,
  });
};
