const {
  numericStringSchema,
  optionalTrimmedString,
  tokenMintAddressSchema,
  uuidSchema,
  z,
} = require('../utils/validation');

const requestTypeEnum = z.enum(['MINT', 'TRANSFER', 'BURN']);
const listStatusEnum = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'READY_FOR_EXECUTION',
  'EXECUTED',
  'FAILED',
]);

const baseRequestBody = {
  requestType: requestTypeEnum,
  tokenMintAddress: tokenMintAddressSchema,
  amount: numericStringSchema,
  sourceWalletId: uuidSchema.nullable().optional(),
  destinationWalletId: uuidSchema.nullable().optional(),
  remarks: optionalTrimmedString.nullable().optional(),
};

const createTokenRequestSchema = z.object({
  body: z.object(baseRequestBody),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const updateTokenRequestSchema = z.object({
  body: z
    .object({
      requestType: requestTypeEnum.optional(),
      tokenMintAddress: tokenMintAddressSchema.optional(),
      amount: numericStringSchema.optional(),
      sourceWalletId: uuidSchema.nullable().optional(),
      destinationWalletId: uuidSchema.nullable().optional(),
      remarks: optionalTrimmedString.nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const listTokenRequestsQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    status: listStatusEnum.optional(),
    requestType: requestTypeEnum.optional(),
    makerUserId: uuidSchema.optional(),
    checkerUserId: uuidSchema.optional(),
    sourceWalletId: uuidSchema.optional(),
    destinationWalletId: uuidSchema.optional(),
    tokenMintAddress: z.string().trim().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'amount', 'approvedAt', 'executedAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const tokenRequestIdParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const recordExecutionSchema = z.object({
  body: z.object({
    status: z.enum(['EXECUTED', 'FAILED']),
    txSignature: z.string().trim().optional(),
    explorerUrl: z.string().trim().url('explorerUrl must be a valid URL').optional(),
    executionError: z.string().trim().optional(),
  }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

module.exports = {
  createTokenRequestSchema,
  updateTokenRequestSchema,
  listTokenRequestsQuerySchema,
  tokenRequestIdParamSchema,
  recordExecutionSchema,
};
