const express = require("express");
const router = express.Router();
const bipsService = require("../services/bips.service");

// ─── Error Response Helper ────────────────────────────────────────────────────
const handleError = (res, err) => {
  const status = err.response?.status || 500;
  const upstream = err.response?.data;
  const message =
    upstream?.response_description ||
    upstream?.message ||
    upstream?.detail ||
    err.message ||
    "Internal server error";
  res.status(status).json({ success: false, message, upstream });
};

const normalizeBipsBody = (body = {}) => ({
  Amount: body.Amount ?? body.amount,
  BeneficiaryAccountName: body.BeneficiaryAccountName ?? body.beneficiaryAccountName,
  BeneficiaryAccountNumber: body.BeneficiaryAccountNumber ?? body.beneficiaryAccountNumber,
  BeneficiaryBankCode: body.BeneficiaryBankCode ?? body.beneficiaryBankCode,
  SourceAccountName: body.SourceAccountName ?? body.sourceAccountName,
  SourceAccountNumber: body.SourceAccountNumber ?? body.sourceAccountNumber,
  SourceBankCode: body.SourceBankCode ?? body.sourceBankCode,
  TransferPurpose: body.TransferPurpose ?? body.transferPurpose,
  request_id: body.request_id ?? body.requestId,
  reference_number: body.reference_number ?? body.referenceNumber,
});

// ─── POST /api/bips/account-inquiry ──────────────────────────────────────────
// Step 1 of the happy flow: validate beneficiary account
const accountInquiryHandler = async (req, res) => {
  try {
    const body = normalizeBipsBody(req.body);
    const {
      Amount,
      BeneficiaryAccountNumber,
      BeneficiaryBankCode,
      SourceAccountName,
      SourceAccountNumber,
      SourceBankCode,
      TransferPurpose,
      request_id,
    } = body;

    // Validate required fields
    const required = [
      "Amount", "BeneficiaryAccountNumber", "BeneficiaryBankCode",
      "SourceAccountName", "SourceAccountNumber", "SourceBankCode", "TransferPurpose",
    ];
    const missing = required.filter((f) => !body[f]);
    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing fields: ${missing.join(", ")}` });
    }

    // request_id MUST come from the frontend; reject if missing
    if (!request_id) {
      return res.status(400).json({ success: false, message: "request_id is required (generate on frontend)" });
    }

    const result = await bipsService.accountInquiry({
      Amount, BeneficiaryAccountNumber, BeneficiaryBankCode,
      SourceAccountName, SourceAccountNumber, SourceBankCode,
      TransferPurpose, request_id,
    });

    // Only proceed if BIPS returns success
    if (result.response_code !== "0000") {
      return res.status(200).json({
        success: false,
        response_code: result.response_code,
        message: result.response_description || result.response_message,
      });
    }

    res.json({ success: true, data: result.response_data, raw: result });
  } catch (err) {
    handleError(res, err);
  }
};

router.post("/account-inquery", accountInquiryHandler);
router.post("/account-inquiry", accountInquiryHandler);

// ─── POST /api/bips/transfer ──────────────────────────────────────────────────
// Step 2 of the happy flow: debit + transfer
// IMPORTANT: Always verify with pg_transaction_status after this call
router.post("/transfer", async (req, res) => {
  try {
    const body = normalizeBipsBody(req.body);
    const {
      Amount, BeneficiaryAccountName, BeneficiaryAccountNumber, BeneficiaryBankCode,
      SourceAccountName, SourceAccountNumber, SourceBankCode,
      TransferPurpose, request_id, reference_number,
    } = body;

    if (!reference_number) {
      return res.status(400).json({ success: false, message: "reference_number from account inquiry is required" });
    }
    if (!request_id) {
      return res.status(400).json({ success: false, message: "request_id is required" });
    }

    const result = await bipsService.outgoingTransfer({
      Amount, BeneficiaryAccountName, BeneficiaryAccountNumber, BeneficiaryBankCode,
      SourceAccountName, SourceAccountNumber, SourceBankCode,
      TransferPurpose, request_id, reference_number,
    });

    // NOTE: Adapter always returns success even on RMA failure.
    // We always follow up with a status check using rr_number.
    const rrNumber = result.response_data?.rr_number;

    // Post-transfer status verification
    let statusVerification = null;
    if (rrNumber) {
      try {
        statusVerification = await bipsService.checkTransactionStatus(rrNumber);
      } catch (statusErr) {
        console.warn("[BIPS] Status check failed after transfer:", statusErr.message);
        // Don't fail the whole response — flag it for ops
        statusVerification = { error: "Status check unavailable — manual verification required" };
      }
    }

    res.json({
      success: result.response_code === "0000",
      data: result.response_data,
      status_verification: statusVerification,
      raw: result,
    });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /api/bips/transaction-status/:id ────────────────────────────────────
router.get("/transaction-status/:id", async (req, res) => {
  try {
    const result = await bipsService.checkTransactionStatus(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /api/bips/bank-codes ─────────────────────────────────────────────────
router.get("/bank-codes", async (req, res) => {
  try {
    const result = await bipsService.getBankCodes();
    res.json({ success: true, data: result });
  } catch (err) {
    // Fallback to static dictionary if API is down
    res.json({
      success: true,
      data: [
        { name: "DK", code: "1060", bin: "667707", pan: "94009405" },
        { name: "BOB", code: "1010", bin: "502237", pan: "94009400" },
        { name: "BNB", code: "1020", bin: "639545", pan: "94009401" },
        { name: "DPNB", code: "1030", bin: "502942", pan: "94009402" },
        { name: "T-Bank", code: "1040", bin: "636243", pan: "94009403" },
        { name: "BDBL", code: "1050", bin: "637053", pan: "94009404" },
      ],
      fallback: true,
    });
  }
});

// ─── GET /api/bips/live-inquiry ───────────────────────────────────────────────
router.get("/live-inquiry", async (req, res) => {
  try {
    const result = await bipsService.liveInquiry();
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /api/bips/eod ────────────────────────────────────────────────────────
router.get("/eod", async (req, res) => {
  try {
    const result = await bipsService.eodExpose();
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
