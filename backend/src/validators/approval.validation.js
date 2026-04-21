const { optionalTrimmedString, requiredTrimmedString, uuidSchema, z } = require('../utils/validation');

const approveSchema = z.object({
  body: z.object({
    comment: optionalTrimmedString,
  }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const rejectSchema = z.object({
  body: z.object({
    rejectionReason: requiredTrimmedString,
    comment: optionalTrimmedString,
  }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

module.exports = {
  approveSchema,
  rejectSchema,
};
