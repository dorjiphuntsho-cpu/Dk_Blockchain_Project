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

const removeCheckerSchema = z.object({
  body: emptyObjectSchema,
  params: z.object({
    checkerAddress: walletAddressSchema,
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
  }),
  params: emptyObjectSchema,
  query: emptyObjectSchema,
});

module.exports = {
  addCheckerSchema,
  createTokenMintSchema,
  removeCheckerSchema,
  setAdminSchema,
  solanaConfigStatusSchema,
};
