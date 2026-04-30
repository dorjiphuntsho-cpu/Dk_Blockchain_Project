const { walletAddressSchema, z } = require('../utils/validation');

const emptyObjectSchema = z.object({}).optional();

const solanaConfigStatusSchema = z.object({
  body: emptyObjectSchema,
  params: emptyObjectSchema,
  query: emptyObjectSchema,
});

const addCheckerSchema = z.object({
  body: z.object({
    checkerAddress: walletAddressSchema,
  }),
  params: emptyObjectSchema,
  query: emptyObjectSchema,
});

const addTreasuryAccountSchema = z.object({
  body: z.object({
    treasuryAccountAddress: walletAddressSchema,
  }),
  params: emptyObjectSchema,
  query: emptyObjectSchema,
});

const removeCheckerSchema = z.object({
  body: emptyObjectSchema,
  params: z.object({
    checkerAddress: walletAddressSchema,
  }),
  query: emptyObjectSchema,
});

const removeTreasuryAccountSchema = z.object({
  body: emptyObjectSchema,
  params: z.object({
    treasuryAccountAddress: walletAddressSchema,
  }),
  query: emptyObjectSchema,
});

const setAdminSchema = z.object({
  body: z.object({
    newAdminAddress: walletAddressSchema,
  }),
  params: emptyObjectSchema,
  query: emptyObjectSchema,
});

const createTokenMintSchema = z.object({
  body: z.object({
    decimals: z.coerce.number().int().min(0).max(9).default(0),
    name: z.string().trim().min(1).max(32),
    symbol: z.string().trim().min(1).max(10),
    uri: z.string().trim().url().max(200),
    // Phase A: Track which admin wallet created this token
    adminWalletAddress: z.string().trim().min(1).max(44).optional(),
  }),
  params: emptyObjectSchema,
  query: emptyObjectSchema,
});

const recordCreatedTokenMintSchema = z.object({
  body: z.object({
    decimals: z.coerce.number().int().min(0).max(9),
    name: z.string().trim().min(1).max(32),
    symbol: z.string().trim().min(1).max(10),
    metadataUri: z.string().trim().url().max(200).optional().nullable(),
    mintAddress: walletAddressSchema,
    tokenAuthority: walletAddressSchema,
    txSignature: z.string().trim().min(1),
    explorerUrl: z.string().trim().url(),
    adminWalletAddress: walletAddressSchema.optional().nullable(),
    metadataAddress: walletAddressSchema.optional().nullable(),
    metadataUpdateAuthority: walletAddressSchema.optional().nullable(),
    metadataTxSignature: z.string().trim().min(1).optional().nullable(),
    mintAuthority: walletAddressSchema.optional().nullable(),
    freezeAuthority: walletAddressSchema.optional().nullable(),
  }),
  params: emptyObjectSchema,
  query: emptyObjectSchema,
});

module.exports = {
  addCheckerSchema,
  addTreasuryAccountSchema,
  createTokenMintSchema,
  recordCreatedTokenMintSchema,
  removeCheckerSchema,
  removeTreasuryAccountSchema,
  setAdminSchema,
  solanaConfigStatusSchema,
};
