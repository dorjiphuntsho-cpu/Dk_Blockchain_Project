const { z } = require('zod');

const uuidSchema = z.string().uuid('Invalid UUID');

const trimmedString = z.string().trim();
const requiredTrimmedString = trimmedString.min(1, 'This field is required');
const optionalTrimmedString = trimmedString.min(1).optional();

const booleanFromUnknown = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}, z.boolean());

const optionalBooleanFromUnknown = booleanFromUnknown.optional();

const numericStringSchema = z.preprocess((value) => {
  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
}, z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a positive number').refine((value) => Number(value) > 0, {
  message: 'Amount must be greater than zero',
}));

const walletAddressSchema = trimmedString
  .min(32, 'Wallet address must be at least 32 characters')
  .max(64, 'Wallet address must be at most 64 characters')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Wallet address format is invalid');

const tokenMintAddressSchema = trimmedString
  .min(32, 'Token mint address must be at least 32 characters')
  .max(64, 'Token mint address must be at most 64 characters')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Token mint address format is invalid');

const dateStringSchema = z.string().datetime({ offset: true }).or(z.string().date());

module.exports = {
  z,
  uuidSchema,
  trimmedString,
  requiredTrimmedString,
  optionalTrimmedString,
  booleanFromUnknown,
  optionalBooleanFromUnknown,
  numericStringSchema,
  walletAddressSchema,
  tokenMintAddressSchema,
  dateStringSchema,
};
