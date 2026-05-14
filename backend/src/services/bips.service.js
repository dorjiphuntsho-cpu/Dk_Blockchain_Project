const axios = require("axios");

const BASE_URL = `${process.env.BIPS_BASE_URL || "https://dk-paymentrmaapp.uat.digitalkidu.bt:4009"}/api/bips`;
const TIMEOUT = Number(process.env.BIPS_TIMEOUT_MS || 45000);

const bipsClient = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  headers: { "Content-Type": "application/json" },
});

// ─── Interceptor: log every request/response for debugging ───────────────────
bipsClient.interceptors.request.use((config) => {
  const payload = config.data ?? config.params ?? null;
  console.log("[BIPS] Sending payload:", JSON.stringify(payload, null, 2));
  return config;
});

bipsClient.interceptors.response.use(
  (res) => {
    console.log(`[BIPS] Response ${res.status}:`, res.data);
    return res;
  },
  (err) => {
    console.error(`[BIPS] Error:`, err.response?.data || err.message);
    return Promise.reject(err);
  }
);

// ─── 1. Account Inquiry ───────────────────────────────────────────────────────
const normalizeInquiryPayload = (payload = {}) => ({
  Amount: payload.Amount ?? payload.amount,
  BeneficiaryAccountName: payload.BeneficiaryAccountName ?? payload.beneficiaryAccountName,
  BeneficiaryAccountNumber: payload.BeneficiaryAccountNumber ?? payload.beneficiaryAccountNumber,
  BeneficiaryBankCode: payload.BeneficiaryBankCode ?? payload.beneficiaryBankCode,
  SourceAccountName: payload.SourceAccountName ?? payload.sourceAccountName,
  SourceAccountNumber: payload.SourceAccountNumber ?? payload.sourceAccountNumber,
  SourceBankCode: payload.SourceBankCode ?? payload.sourceBankCode,
  TransferPurpose: payload.TransferPurpose ?? payload.transferPurpose,
  request_id: payload.request_id ?? payload.requestId,
  reference_number: payload.reference_number ?? payload.referenceNumber,
  settlementRequestId: payload.settlementRequestId ?? payload.settlement_request_id,
});

const accountInquiry = async (payload = {}) => {
  const normalized = normalizeInquiryPayload(payload);
  const { data } = await bipsClient.post("/account-inquery", {
    Amount: normalized.Amount,
    BeneficiaryAccountNumber: normalized.BeneficiaryAccountNumber,
    BeneficiaryBankCode: normalized.BeneficiaryBankCode,
    SourceAccountName: normalized.SourceAccountName,
    SourceAccountNumber: normalized.SourceAccountNumber,
    SourceBankCode: normalized.SourceBankCode,
    TransferPurpose: normalized.TransferPurpose,
    request_id: normalized.request_id,
  });
  return data;
};

// ─── 2. Outgoing (Fund Transfer / Debit) ─────────────────────────────────────
const outgoingTransfer = async (payload = {}) => {
  const normalized = normalizeInquiryPayload(payload);
  const { data } = await bipsClient.post("/outgoing", {
    Amount: normalized.Amount,
    BeneficiaryAccountName: normalized.BeneficiaryAccountName,
    BeneficiaryAccountNumber: normalized.BeneficiaryAccountNumber,
    BeneficiaryBankCode: normalized.BeneficiaryBankCode,
    SourceAccountName: normalized.SourceAccountName,
    SourceAccountNumber: normalized.SourceAccountNumber,
    SourceBankCode: normalized.SourceBankCode,
    TransferPurpose: normalized.TransferPurpose,
    request_id: normalized.request_id,
    reference_number: normalized.reference_number,
  });
  return data;
};

// ─── 3. Incoming ─────────────────────────────────────────────────────────────
const incomingTransfer = async (payload) => {
  const { data } = await bipsClient.post("/incoming", payload);
  return data;
};

// ─── 4. PG Status Check ──────────────────────────────────────────────────────
// IMPORTANT: Always call this after outgoing — adapter returns success even on failure
const checkTransactionStatus = async (transaction_id) => {
  const { data } = await bipsClient.get("/pg_transaction_status", {
    params: { transaction_id },
  });
  return data;
};

// ─── 5. Live Inquiry ─────────────────────────────────────────────────────────
const liveInquiry = async () => {
  const { data } = await bipsClient.get("/live-inquery");
  return data;
};

// ─── 6. EOD (End of Day) ─────────────────────────────────────────────────────
const eodExpose = async () => {
  const { data } = await bipsClient.get("/db_expose");
  return data;
};

// ─── 7. Bank Codes ───────────────────────────────────────────────────────────
const getBankCodes = async () => {
  const { data } = await bipsClient.get("/bank-code");
  return data;
};

module.exports = {
  accountInquiry,
  outgoingTransfer,
  incomingTransfer,
  checkTransactionStatus,
  liveInquiry,
  eodExpose,
  getBankCodes,
};
