const { z } = require('zod');

const uuidSchema = z.string().uuid('Invalid UUID');
const emptyStringToUndefined = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const trimmedString = z.string().trim();
const requiredTrimmedString = trimmedString.min(1, 'This field is required');
const optionalTrimmedString = trimmedString.min(1).optional();
const optionalUuidQuerySchema = z.preprocess(emptyStringToUndefined, uuidSchema.optional());
const optionalTrimmedQueryString = z.preprocess(emptyStringToUndefined, trimmedString.optional());
const optionalEnumQuerySchema = (enumSchema) => z.preprocess(emptyStringToUndefined, enumSchema.optional());
const optionalEnumArraySchema = (enumSchema) => z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}, z.array(enumSchema).optional());

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

const optionalBooleanFromUnknown = z.preprocess(emptyStringToUndefined, booleanFromUnknown.optional());

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
  emptyStringToUndefined,
  trimmedString,
  requiredTrimmedString,
  optionalTrimmedString,
  optionalUuidQuerySchema,
  optionalTrimmedQueryString,
  optionalEnumQuerySchema,
  optionalEnumArraySchema,
  booleanFromUnknown,
  optionalBooleanFromUnknown,
  numericStringSchema,
  walletAddressSchema,
  tokenMintAddressSchema,
  dateStringSchema,
};
