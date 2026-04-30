const {
  emptyStringToUndefined,
  numericStringSchema,
  optionalTrimmedString,
  requiredTrimmedString,
  z,
} = require('../utils/validation');

const callbackBodySchema = z
  .object({
    paymentReference: optionalTrimmedString,
    payment_reference: optionalTrimmedString,
    transactionReference: optionalTrimmedString,
    transaction_reference: optionalTrimmedString,
    gatewayTransactionId: optionalTrimmedString,
    gateway_transaction_id: optionalTrimmedString,
    transactionId: optionalTrimmedString,
    transaction_id: optionalTrimmedString,
    customerReference: optionalTrimmedString,
    customer_reference: optionalTrimmedString,
    payerName: optionalTrimmedString,
    payer_name: optionalTrimmedString,
    payerAccount: optionalTrimmedString,
    payer_account: optionalTrimmedString,
    amount: numericStringSchema.optional(),
    transactionAmount: numericStringSchema.optional(),
    transaction_amount: numericStringSchema.optional(),
    currency: optionalTrimmedString,
    currencyCode: optionalTrimmedString,
    currency_code: optionalTrimmedString,
    status: optionalTrimmedString,
    paymentStatus: optionalTrimmedString,
    payment_status: optionalTrimmedString,
    transactionStatus: optionalTrimmedString,
    transaction_status: optionalTrimmedString,
    statusMessage: optionalTrimmedString,
    status_message: optionalTrimmedString,
    message: optionalTrimmedString,
    description: optionalTrimmedString,
    confirmedAt: optionalTrimmedString,
    confirmed_at: optionalTrimmedString,
    paymentTime: optionalTrimmedString,
    payment_time: optionalTrimmedString,
    transactionTime: optionalTrimmedString,
    transaction_time: optionalTrimmedString,
    data: z.record(z.any()).optional(),
    response_data: z.record(z.any()).optional(),
  })
  .passthrough()
  .refine(
    (data) => {
      const source = { ...data, ...(data.data || {}), ...(data.response_data || {}) };
      return !!(
        source.paymentReference ||
        source.payment_reference ||
        source.transactionReference ||
        source.transaction_reference
      );
    },
    {
      message: 'Payment reference is required',
      path: ['paymentReference'],
    },
  )
  .refine(
    (data) => {
      const source = { ...data, ...(data.data || {}), ...(data.response_data || {}) };
      return !!(source.amount || source.transactionAmount || source.transaction_amount);
    },
    {
      message: 'Amount is required',
      path: ['amount'],
    },
  )
  .refine(
    (data) => {
      const source = { ...data, ...(data.data || {}), ...(data.response_data || {}) };
      return !!(
        source.status ||
        source.paymentStatus ||
        source.payment_status ||
        source.transactionStatus ||
        source.transaction_status
      );
    },
    {
      message: 'Status is required',
      path: ['status'],
    },
  );

const paymentReferenceParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    paymentReference: z.preprocess(emptyStringToUndefined, requiredTrimmedString),
  }),
  query: z.object({}).optional(),
});

const paymentCallbackSchema = z.object({
  body: callbackBodySchema,
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const paymentReferenceLookupSchema = paymentReferenceParamSchema;

const paymentStatusVerifySchema = paymentReferenceParamSchema;

module.exports = {
  paymentCallbackSchema,
  paymentReferenceLookupSchema,
  paymentStatusVerifySchema,
};
