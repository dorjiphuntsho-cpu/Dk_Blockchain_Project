const { optionalTrimmedString, requiredTrimmedString, uuidSchema, z } = require('../utils/validation');

const approveSchema = z.object({
  body: z.object({
    comment: optionalTrimmedString,
    txSignature: optionalTrimmedString,
    explorerUrl: z.string().trim().url('explorerUrl must be a valid URL').optional().or(z.literal('')),
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
    txSignature: optionalTrimmedString,
    explorerUrl: z.string().trim().url('explorerUrl must be a valid URL').optional().or(z.literal('')),
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
