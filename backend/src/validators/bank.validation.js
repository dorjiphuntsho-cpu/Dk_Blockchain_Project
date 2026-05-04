const {
  optionalBooleanFromUnknown,
  optionalEnumQuerySchema,
  optionalTrimmedQueryString,
  optionalTrimmedString,
  optionalUuidQuerySchema,
  requiredTrimmedString,
  tokenMintAddressSchema,
  uuidSchema,
  walletAddressSchema,
  z,
} = require('../utils/validation');

const bankAccountTypeEnum = z.enum(['RESERVE', 'BIPS_SETTLEMENT', 'OTHER']);
const bankTokenAccountPurposeEnum = z.enum(['TREASURY', 'DISTRIBUTION']);

const listBanksQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    code: optionalTrimmedQueryString,
    name: optionalTrimmedQueryString,
    supportsBtn: optionalBooleanFromUnknown,
    supportsBipsSettlement: optionalBooleanFromUnknown,
    isIssuer: optionalBooleanFromUnknown,
    isActive: optionalBooleanFromUnknown,
    sortBy: optionalEnumQuerySchema(z.enum(['createdAt', 'updatedAt', 'name', 'code'])),
    sortOrder: optionalEnumQuerySchema(z.enum(['asc', 'desc'])),
  }),
});

const bankIdParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const bankAccountIdParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
    accountId: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const bankTokenAccountIdParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
    tokenAccountId: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const updateBankSchema = z.object({
  body: z
    .object({
      name: requiredTrimmedString.optional(),
      binNumber: optionalTrimmedString.nullable().optional(),
      panNumber: optionalTrimmedString.nullable().optional(),
      treasuryWalletAddress: walletAddressSchema.nullable().optional(),
      supportsBtn: z.boolean().optional(),
      supportsBipsSettlement: z.boolean().optional(),
      isIssuer: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const createBankAccountSchema = z.object({
  body: z.object({
    accountType: bankAccountTypeEnum,
    accountName: requiredTrimmedString,
    accountNumber: requiredTrimmedString,
    currency: requiredTrimmedString.optional().default('BTN'),
    isPrimary: z.boolean().optional().default(true),
    isActive: z.boolean().optional().default(true),
    remarks: optionalTrimmedString.nullable().optional(),
  }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const updateBankAccountSchema = z.object({
  body: z
    .object({
      accountName: requiredTrimmedString.optional(),
      accountNumber: requiredTrimmedString.optional(),
      currency: requiredTrimmedString.optional(),
      isPrimary: z.boolean().optional(),
      isActive: z.boolean().optional(),
      remarks: optionalTrimmedString.nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
  params: z.object({
    id: uuidSchema,
    accountId: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const createBankTokenAccountSchema = z.object({
  body: z.object({
    mintAddress: tokenMintAddressSchema,
    purpose: bankTokenAccountPurposeEnum.optional().default('TREASURY'),
    treasuryWalletAddress: walletAddressSchema,
    tokenAccountAddress: walletAddressSchema,
    isPrimary: z.boolean().optional().default(true),
    isActive: z.boolean().optional().default(true),
    remarks: optionalTrimmedString.nullable().optional(),
  }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const updateBankTokenAccountSchema = z.object({
  body: z
    .object({
      purpose: bankTokenAccountPurposeEnum.optional(),
      treasuryWalletAddress: walletAddressSchema.optional(),
      tokenAccountAddress: walletAddressSchema.optional(),
      isPrimary: z.boolean().optional(),
      isActive: z.boolean().optional(),
      remarks: optionalTrimmedString.nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
  params: z.object({
    id: uuidSchema,
    tokenAccountId: uuidSchema,
  }),
  query: z.object({}).optional(),
});

module.exports = {
  listBanksQuerySchema,
  bankIdParamSchema,
  bankAccountIdParamSchema,
  bankTokenAccountIdParamSchema,
  updateBankSchema,
  createBankAccountSchema,
  updateBankAccountSchema,
  createBankTokenAccountSchema,
  updateBankTokenAccountSchema,
};
