const { requiredTrimmedString, z } = require('../utils/validation');

const loginSchema = z.object({
  body: z.object({
    email: requiredTrimmedString.email('Invalid email format'),
    password: requiredTrimmedString,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = {
  loginSchema,
};
