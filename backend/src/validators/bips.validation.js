const {
  numericStringSchema,
  optionalTrimmedString,
  optionalTrimmedQueryString,
  optionalUuidQuerySchema,
  requiredTrimmedString,
  z,
} = require('../utils/validation');

const accountInquirySchema = z.object({
  body: z.object({
    amount: numericStringSchema,
    beneficiaryAccountNumber: requiredTrimmedString,
    beneficiaryBankCode: requiredTrimmedString,
    sourceAccountName: requiredTrimmedString,
    sourceAccountNumber: requiredTrimmedString,
    sourceBankCode: optionalTrimmedString.optional(),
    transferPurpose: requiredTrimmedString,
    requestId: requiredTrimmedString,
    settlementRequestId: optionalUuidQuerySchema,
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const outgoingSchema = z.object({
  body: z.object({
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
  }),
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
  pgStatusQuerySchema,
  liveInquiryQuerySchema,
};
