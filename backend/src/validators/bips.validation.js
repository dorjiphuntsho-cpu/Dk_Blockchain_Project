const {
  numericStringSchema,
  optionalTrimmedString,
  optionalTrimmedQueryString,
  optionalUuidQuerySchema,
  requiredTrimmedString,
  z,
} = require('../utils/validation');

function normalizeBipsBody(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  return {
    amount: value.amount ?? value.Amount,
    beneficiaryAccountName: value.beneficiaryAccountName ?? value.BeneficiaryAccountName,
    beneficiaryAccountNumber: value.beneficiaryAccountNumber ?? value.BeneficiaryAccountNumber,
    beneficiaryBankCode: value.beneficiaryBankCode ?? value.BeneficiaryBankCode,
    sourceAccountName: value.sourceAccountName ?? value.SourceAccountName,
    sourceAccountNumber: value.sourceAccountNumber ?? value.SourceAccountNumber,
    sourceBankCode: value.sourceBankCode ?? value.SourceBankCode,
    transferPurpose: value.transferPurpose ?? value.TransferPurpose,
    requestId: value.requestId ?? value.request_id ?? value.RequestId ?? value.RequestID,
    referenceNumber: value.referenceNumber ?? value.reference_number ?? value.ReferenceNumber,
    settlementRequestId:
      value.settlementRequestId ?? value.settlement_request_id ?? value.SettlementRequestId,
  };
}

const accountInquirySchema = z.object({
  body: z.preprocess(normalizeBipsBody, z.object({
    amount: numericStringSchema,
    beneficiaryAccountNumber: requiredTrimmedString,
    beneficiaryBankCode: requiredTrimmedString,
    sourceAccountName: requiredTrimmedString,
    sourceAccountNumber: requiredTrimmedString,
    sourceBankCode: optionalTrimmedString.optional(),
    transferPurpose: requiredTrimmedString,
    requestId: requiredTrimmedString,
    settlementRequestId: optionalUuidQuerySchema,
  })),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const outgoingSchema = z.object({
  body: z.preprocess(normalizeBipsBody, z.object({
    amount: numericStringSchema,
    beneficiaryAccountName: requiredTrimmedString,
    beneficiaryAccountNumber: requiredTrimmedString,
    beneficiaryBankCode: requiredTrimmedString,
    sourceAccountName: requiredTrimmedString,
    sourceAccountNumber: requiredTrimmedString,
    sourceBankCode: optionalTrimmedString.optional(),
    transferPurpose: requiredTrimmedString,
    requestId: requiredTrimmedString,
    referenceNumber: requiredTrimmedString,
    settlementRequestId: optionalUuidQuerySchema,
  })),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const transferFlowSchema = z.object({
  body: z.preprocess(normalizeBipsBody, z.object({
    amount: numericStringSchema,
    beneficiaryAccountName: requiredTrimmedString,
    beneficiaryAccountNumber: requiredTrimmedString,
    beneficiaryBankCode: requiredTrimmedString,
    sourceAccountName: requiredTrimmedString,
    sourceAccountNumber: requiredTrimmedString,
    sourceBankCode: optionalTrimmedString.optional(),
    transferPurpose: requiredTrimmedString,
    requestId: requiredTrimmedString,
    settlementRequestId: optionalUuidQuerySchema,
  })),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const pgStatusQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    transactionId: requiredTrimmedString,
    settlementRequestId: optionalUuidQuerySchema,
    requestId: optionalTrimmedQueryString,
  }),
});

const liveInquiryQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    transactionId: optionalTrimmedQueryString,
    requestId: optionalTrimmedQueryString,
    referenceNumber: optionalTrimmedQueryString,
    settlementRequestId: optionalUuidQuerySchema,
  }),
});

module.exports = {
  accountInquirySchema,
  outgoingSchema,
  transferFlowSchema,
  pgStatusQuerySchema,
  liveInquiryQuerySchema,
};
