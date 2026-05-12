const dotenv = require('dotenv');
const { z } = require('zod');
const { applyDatabaseUrl } = require('../utils/databaseUrl');

dotenv.config();
applyDatabaseUrl(process.env);

const optionalNonEmptyString = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized === '' ? undefined : normalized;
}, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_DIALECT: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().optional(),
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  AUTO_GENERATE_PRISMA: z.preprocess((value) => {
    if (value === undefined) {
      return true;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    return String(value).toLowerCase() === 'true';
  }, z.boolean()),
  AUTO_SYNC_DB: z.preprocess((value) => {
    if (value === undefined) {
      return true;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    return String(value).toLowerCase() === 'true';
  }, z.boolean()),
  DEFAULT_ADMIN_EMAIL: z.string().email().optional(),
  DEFAULT_ADMIN_PASSWORD: z.string().optional(),
  DEFAULT_MAKER_EMAIL: z.string().email().optional(),
  DEFAULT_MAKER_PASSWORD: z.string().optional(),
  DEFAULT_CHECKER_EMAIL: z.string().email().optional(),
  DEFAULT_CHECKER_PASSWORD: z.string().optional(),
  DEFAULT_EXECUTOR_EMAIL: z.string().email().optional(),
  DEFAULT_EXECUTOR_PASSWORD: z.string().optional(),
  SOLANA_RPC_URL: z.string().url().default('https://api.devnet.solana.com'),
  SOLANA_COMMITMENT: z.enum(['processed', 'confirmed', 'finalized']).default('confirmed'),
  SOLANA_PROGRAM_ID: optionalNonEmptyString,
  SOLANA_PROGRAM_IDL_PATH: z.string().min(1).default('dk-token/target/idl/dk_token.json'),
  SOLANA_CONFIG_ADDRESS: optionalNonEmptyString,
  SOLANA_CONFIG_KEYPAIR_PATH: optionalNonEmptyString,
  SOLANA_ADMIN_KEYPAIR_PATH: optionalNonEmptyString,
  SOLANA_MAKER_KEYPAIR_PATH: optionalNonEmptyString,
  SOLANA_TREASURY_OWNER_KEYPAIR_PATH: optionalNonEmptyString,
  SOLANA_CHECKER_KEYPAIR_PATH: optionalNonEmptyString,
  SOLANA_AUTO_BOOTSTRAP: z.preprocess((value) => {
    if (value === undefined) {
      return true;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    return String(value).toLowerCase() === 'true';
  }, z.boolean()),
  SOLANA_BOOTSTRAP_MODE: z.preprocess((value) => {
    if (value === undefined) {
      return process.env.SOLANA_AUTO_BOOTSTRAP === 'false' ? 'disabled' : 'strict';
    }

    if (typeof value === 'boolean') {
      return value ? 'strict' : 'disabled';
    }

    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true') {
      return 'strict';
    }

    if (normalized === 'false') {
      return 'disabled';
    }

    return normalized;
  }, z.enum(['strict', 'warn', 'disabled'])),
  BIPS_BASE_URL: z.string().url().optional(),
  BIPS_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  BIPS_API_USER_ID: optionalNonEmptyString,
  BIPS_API_PASSWORD: optionalNonEmptyString,
  BIPS_CLIENT_ID: optionalNonEmptyString,
  BIPS_CHANNEL_TYPE: optionalNonEmptyString,
  BIPS_ACCINQ_API_KEY: optionalNonEmptyString,
  BIPS_IMPSCR_API_KEY: optionalNonEmptyString,
  BIPS_SOURCE_BANK_CODE: optionalNonEmptyString,
  BIPS_SOURCE_BIN_NUMBER: optionalNonEmptyString,
  BIPS_SOURCE_PAN_NUMBER: optionalNonEmptyString,
  BIPS_RECONCILE_BATCH_LIMIT: z.coerce.number().int().positive().max(100).default(20),
  BIPS_RECONCILE_INCLUDE_MANUAL_REVIEW: z.preprocess((value) => {
    if (value === undefined) {
      return false;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    return String(value).toLowerCase() === 'true';
  }, z.boolean()),
  PAYMENT_GATEWAY_NAME: z.string().min(1).default('DK_PAYMENT_GATEWAY'),
  PAYMENT_GATEWAY_BASE_URL: optionalNonEmptyString,
  PAYMENT_GATEWAY_AUTH_TOKEN_PATH: z.string().min(1).default('v1/auth/token'),
  PAYMENT_GATEWAY_FETCH_KEY_PATH: z.string().min(1).default('v1/sign/key'),
  PAYMENT_GATEWAY_FUND_TRANSFER_PATH: z.string().min(1).default('v1/initiate/transaction'),
  PAYMENT_GATEWAY_ACCOUNT_AUTH_PATH: z.string().min(1).default('v1/account_auth/pull-payment'),
  PAYMENT_GATEWAY_DEBIT_REQUEST_PATH: z.string().min(1).default('v1/debit_request/pull-payment'),
  PAYMENT_GATEWAY_BENEFICIARY_INQUIRY_PATH: z.string().min(1).default('v1/beneficiary/account_inquiry'),
  PAYMENT_GATEWAY_TRANSACTION_STATUS_TODAY_PATH: z.string().min(1).default('v1/transaction/status'),
  PAYMENT_GATEWAY_TRANSACTION_STATUS_HISTORY_PATH: z.string().min(1).default('v1/transactions/status'),
  PAYMENT_GATEWAY_STATUS_PATH: z.string().min(1).default('/api/payments/status'),
  PAYMENT_GATEWAY_STATUS_REFERENCE_QUERY_PARAM: z.string().min(1).default('payment_reference'),
  PAYMENT_GATEWAY_API_KEY: optionalNonEmptyString,
  PAYMENT_GATEWAY_API_KEY_HEADER: z.string().min(1).default('X-gravitee-api-key'),
  PAYMENT_GATEWAY_USERNAME: optionalNonEmptyString,
  PAYMENT_GATEWAY_PASSWORD: optionalNonEmptyString,
  PAYMENT_GATEWAY_CLIENT_ID: optionalNonEmptyString,
  PAYMENT_GATEWAY_CLIENT_SECRET: optionalNonEmptyString,
  PAYMENT_GATEWAY_SOURCE_APP: z.string().min(1).default('SRC_AVS_0201'),
  PAYMENT_GATEWAY_TOKEN_GRANT_TYPE: z.string().min(1).default('password'),
  PAYMENT_GATEWAY_TOKEN_SCOPES: z.string().min(1).default('keys:read'),
  PAYMENT_GATEWAY_WEBHOOK_SECRET: optionalNonEmptyString,
  PAYMENT_GATEWAY_WEBHOOK_SECRET_HEADER: z.string().min(1).default('x-payment-gateway-secret'),
  PAYMENT_GATEWAY_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  PAYMENT_RECONCILE_BATCH_LIMIT: z.coerce.number().int().positive().max(100).default(20),
  PAYMENT_RECONCILE_INCLUDE_TERMINAL_FAILURES: z.preprocess((value) => {
    if (value === undefined) {
      return false;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    return String(value).toLowerCase() === 'true';
  }, z.boolean()),
  CBS_BASE_URL: optionalNonEmptyString,
  CBS_AUTH_TOKEN_PATH: z.string().min(1).default('v1/auth/token'),
  CBS_REFRESH_TOKEN_PATH: z.string().min(1).default('v1/auth/refresh'),
  CBS_FETCH_KEY_PATH: z.string().min(1).default('v1/sign/key'),
  CBS_ACCOUNT_INQUIRY_PATH: z.string().min(1).default('v1/acc/inquiry'),
  CBS_API_KEY: optionalNonEmptyString,
  CBS_API_KEY_HEADER: z.string().min(1).default('X-gravitee-api-key'),
  CBS_USERNAME: optionalNonEmptyString,
  CBS_PASSWORD: optionalNonEmptyString,
  CBS_CLIENT_ID: optionalNonEmptyString,
  CBS_CLIENT_SECRET: optionalNonEmptyString,
  CBS_SOURCE_APP: z.string().min(1).default('SRC_APP_0801'),
  CBS_TOKEN_GRANT_TYPE: z.string().min(1).default('password'),
  CBS_ACCOUNT_INQUIRY_SCOPE: z.string().min(1).default('keys:read accounts:read'),
  CBS_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  BTN_REFERENCE_PRICE: z.coerce.number().positive().default(1),
  BTN_REFERENCE_PRICE_CURRENCY: z.string().min(1).default('BTN'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');
  throw new Error(`Environment validation failed: ${message}`);
}

module.exports = parsed.data;
