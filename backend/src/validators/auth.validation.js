const { requiredTrimmedString, z } = require('../utils/validation');

const loginSchema = z.object({
  body: z.object({
    email: requiredTrimmedString.email('Invalid email format'),
    password: requiredTrimmedString,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const customerLoginSchema = z.object({
  body: z.object({
    cid: requiredTrimmedString.regex(/^\d{11}$/, 'CID must be 11 digits'),
    mpin: requiredTrimmedString.regex(/^\d{4,6}$/, 'MPIN must be 4 to 6 digits'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = {
  customerLoginSchema,
  loginSchema,
};
