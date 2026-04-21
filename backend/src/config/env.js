const dotenv = require('dotenv');
const { z } = require('zod');
const { applyDatabaseUrl } = require('../utils/databaseUrl');

dotenv.config();
applyDatabaseUrl(process.env);

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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');
  throw new Error(`Environment validation failed: ${message}`);
}

module.exports = parsed.data;
