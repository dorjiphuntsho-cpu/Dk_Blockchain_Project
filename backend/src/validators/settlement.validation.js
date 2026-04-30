const {
  numericStringSchema,
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

const settlementRequestTypeEnum = z.enum(['RESERVE_MINT', 'REPLENISHMENT_MINT', 'INTERBANK_TRANSFER', 'REDEMPTION']);
const settlementModeEnum = z.enum(['ON_CHAIN_BTN', 'BIPS_FIAT']);
const settlementStatusEnum = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'INQUIRY_PENDING',
  'INQUIRY_FAILED',
  'READY_FOR_EXECUTION',
  'BIPS_PENDING',
  'SETTLED',
  'FAILED',
  'MANUAL_REVIEW',
  'CANCELLED',
]);

const baseSettlementBody = {
  amount: numericStringSchema,
  tokenMintAddress: tokenMintAddressSchema.optional(),
  transferPurpose: optionalTrimmedString.nullable().optional(),
};

const createReserveMintRequestSchema = z.object({
  body: z.object({
    sourceBankId: uuidSchema,
    reserveLedgerId: uuidSchema,
    tokenMintAddress: tokenMintAddressSchema,
    amount: numericStringSchema,
    transferPurpose: optionalTrimmedString.nullable().optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const createReplenishmentMintRequestSchema = z.object({
  body: z.object({
    sourceBankId: uuidSchema,
    reserveLedgerId: uuidSchema,
    tokenMintAddress: tokenMintAddressSchema,
    amount: numericStringSchema,
    transferPurpose: optionalTrimmedString.nullable().optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const createInterbankTransferRequestSchema = z.object({
  body: z.object({
    sourceBankId: uuidSchema,
    destinationBankId: uuidSchema,
    tokenMintAddress: tokenMintAddressSchema,
    amount: numericStringSchema,
    transferPurpose: requiredTrimmedString,
    beneficiaryAccountName: optionalTrimmedString.nullable().optional(),
    beneficiaryAccountNumber: optionalTrimmedString.nullable().optional(),
    beneficiaryBankCode: optionalTrimmedString.nullable().optional(),
    sourceAccountName: optionalTrimmedString.nullable().optional(),
    sourceAccountNumber: optionalTrimmedString.nullable().optional(),
    requestId: optionalTrimmedString.nullable().optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const createRedemptionRequestSchema = z.object({
  body: z.object({
    sourceBankId: uuidSchema,
    destinationBankId: uuidSchema.optional(),
    tokenMintAddress: tokenMintAddressSchema,
    amount: numericStringSchema,
    transferPurpose: requiredTrimmedString,
    beneficiaryAccountName: requiredTrimmedString,
    beneficiaryAccountNumber: requiredTrimmedString,
    beneficiaryBankCode: requiredTrimmedString,
    sourceAccountName: requiredTrimmedString,
    sourceAccountNumber: requiredTrimmedString,
    requestId: requiredTrimmedString,
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const listSettlementsQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    requestType: optionalEnumQuerySchema(settlementRequestTypeEnum),
    settlementMode: optionalEnumQuerySchema(settlementModeEnum),
    status: optionalEnumQuerySchema(settlementStatusEnum),
    sourceBankId: optionalUuidQuerySchema,
    destinationBankId: optionalUuidQuerySchema,
    reserveLedgerId: optionalUuidQuerySchema,
    requestId: optionalTrimmedQueryString,
    tokenMintAddress: optionalTrimmedQueryString,
    sortBy: optionalEnumQuerySchema(z.enum(['createdAt', 'updatedAt', 'amount', 'approvedAt', 'settledAt'])),
    sortOrder: optionalEnumQuerySchema(z.enum(['asc', 'desc'])),
  }),
});

const settlementIdParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const approveSettlementSchema = z.object({
  body: z.object({
    comment: optionalTrimmedString.nullable().optional(),
  }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const rejectSettlementSchema = z.object({
  body: z.object({
    rejectionReason: requiredTrimmedString,
    comment: optionalTrimmedString.nullable().optional(),
  }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const settlementMakerPreparationQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({
    makerWalletAddress: walletAddressSchema.optional(),
  }),
});

const settlementCheckerPreparationQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({
    checkerWalletAddress: walletAddressSchema.optional(),
  }),
});

const settlementRecordInitiationSchema = z.object({
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

const settlementRecordExecutionSchema = z.object({
  body: z.object({
    status: z.enum(['SETTLED', 'FAILED']),
    txSignature: z.string().trim().optional(),
    explorerUrl: z.string().trim().url('explorerUrl must be a valid URL').optional(),
    executionError: z.string().trim().optional(),
  }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const reconcileSettlementSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const reconcilePendingSettlementsSchema = z.object({
  body: z.object({
    limit: z.coerce.number().int().positive().max(100).optional(),
    includeManualReview: z.preprocess((value) => {
      if (value === undefined) {
        return undefined;
      }

      if (typeof value === 'boolean') {
        return value;
      }

      return String(value).trim().toLowerCase() === 'true';
    }, z.boolean().optional()),
  }).optional(),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

module.exports = {
  createReserveMintRequestSchema,
  createReplenishmentMintRequestSchema,
  createInterbankTransferRequestSchema,
  createRedemptionRequestSchema,
  listSettlementsQuerySchema,
  settlementIdParamSchema,
  approveSettlementSchema,
  rejectSettlementSchema,
  settlementMakerPreparationQuerySchema,
  settlementCheckerPreparationQuerySchema,
  settlementRecordInitiationSchema,
  settlementRecordExecutionSchema,
  reconcileSettlementSchema,
  reconcilePendingSettlementsSchema,
};
