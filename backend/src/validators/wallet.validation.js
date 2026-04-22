const {
  optionalBooleanFromUnknown,
  optionalEnumQuerySchema,
  optionalTrimmedQueryString,
  optionalUuidQuerySchema,
  optionalTrimmedString,
  uuidSchema,
  walletAddressSchema,
  z,
} = require('../utils/validation');

const createWalletSchema = z.object({
  body: z.object({
    userId: uuidSchema,
    walletAddress: walletAddressSchema,
    label: optionalTrimmedString.nullable().optional(),
    isPrimary: z.boolean().optional().default(false),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const listWalletsQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    userId: optionalUuidQuerySchema,
    isActive: optionalBooleanFromUnknown,
    isPrimary: optionalBooleanFromUnknown,
    walletAddress: optionalTrimmedQueryString,
    sortBy: optionalEnumQuerySchema(z.enum(['createdAt', 'updatedAt', 'walletAddress'])),
    sortOrder: optionalEnumQuerySchema(z.enum(['asc', 'desc'])),
  }),
});

const updateWalletSchema = z.object({
  body: z
    .object({
      userId: uuidSchema.optional(),
      walletAddress: walletAddressSchema.optional(),
      label: optionalTrimmedString.nullable().optional(),
      isPrimary: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const updateWalletStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const walletIdParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

module.exports = {
  createWalletSchema,
  listWalletsQuerySchema,
  updateWalletSchema,
  updateWalletStatusSchema,
  walletIdParamSchema,
};
