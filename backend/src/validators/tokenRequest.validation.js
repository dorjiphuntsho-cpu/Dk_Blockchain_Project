const {
  numericStringSchema,
  optionalEnumQuerySchema,
  optionalTrimmedString,
  optionalTrimmedQueryString,
  optionalUuidQuerySchema,
  tokenMintAddressSchema,
  uuidSchema,
  walletAddressSchema,
  z,
} = require('../utils/validation');

const requestTypeEnum = z.enum(['MINT', 'TRANSFER', 'BURN']);
const listStatusEnum = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'READY_FOR_EXECUTION',
  'ON_CHAIN_PENDING',
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
    status: optionalEnumQuerySchema(listStatusEnum),
    requestType: optionalEnumQuerySchema(requestTypeEnum),
    makerUserId: optionalUuidQuerySchema,
    checkerUserId: optionalUuidQuerySchema,
    sourceWalletId: optionalUuidQuerySchema,
    destinationWalletId: optionalUuidQuerySchema,
    tokenMintAddress: optionalTrimmedQueryString,
    dateFrom: optionalTrimmedQueryString,
    dateTo: optionalTrimmedQueryString,
    sortBy: optionalEnumQuerySchema(z.enum(['createdAt', 'updatedAt', 'amount', 'approvedAt', 'executedAt'])),
    sortOrder: optionalEnumQuerySchema(z.enum(['asc', 'desc'])),
  }),
});

const tokenRequestIdParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const checkerPreparationQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({
    checkerWalletAddress: walletAddressSchema.optional(),
  }),
});

const makerPreparationQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({
    makerWalletAddress: walletAddressSchema.optional(),
  }),
});

const recordInitiationSchema = z.object({
  body: z.object({
    makerWalletAddress: walletAddressSchema,
    onChainRequestAddress: walletAddressSchema,
    initiationTxSignature: z.string().trim().min(1, 'initiationTxSignature is required'),
    initiationExplorerUrl: z.string().trim().url('initiationExplorerUrl must be a valid URL').optional(),
    sourceTokenAccountAddress: walletAddressSchema.nullable().optional(),
    destinationTokenAccountAddress: walletAddressSchema.nullable().optional(),
  }),
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

const recordCancellationSchema = z.object({
  body: z.object({
    makerWalletAddress: walletAddressSchema,
    txSignature: z.string().trim().min(1, 'txSignature is required'),
    explorerUrl: z.string().trim().url('explorerUrl must be a valid URL').optional(),
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
  checkerPreparationQuerySchema,
  makerPreparationQuerySchema,
  recordInitiationSchema,
  recordExecutionSchema,
  recordCancellationSchema,
};
