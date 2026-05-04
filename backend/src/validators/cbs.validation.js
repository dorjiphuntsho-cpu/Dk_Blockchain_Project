const { requiredTrimmedString, optionalTrimmedString, z } = require('../utils/validation');

const productTypeEnum = z.enum(['LCY_ACC', 'FCY_ACC']);
const optionalRequestIdSchema = z.string().trim().min(10, 'Request ID must be at least 10 characters').max(36, 'Request ID must be at most 36 characters').optional();

const cbsAccountInquirySchema = z.object({
  body: z.object({
    accountNumber: requiredTrimmedString.regex(/^\d{12}$/, 'Account number must be 12 digits').optional(),
    accountNo: requiredTrimmedString.regex(/^\d{12}$/, 'Account number must be 12 digits').optional(),
    requestId: optionalRequestIdSchema,
    sourceApp: optionalTrimmedString,
    productType: productTypeEnum.optional(),
    channel: optionalTrimmedString,
  }).refine((value) => Boolean(value.accountNumber || value.accountNo), {
    message: 'Either accountNumber or accountNo is required',
    path: ['accountNumber'],
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = {
  cbsAccountInquirySchema,
};
