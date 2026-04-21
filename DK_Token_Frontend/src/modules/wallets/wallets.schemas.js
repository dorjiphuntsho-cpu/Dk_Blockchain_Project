import { z } from 'zod';

const booleanInputSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0' || value === '') {
    return false;
  }

  return value;
}, z.boolean());

export const walletSchema = z.object({
  userId: z.string().min(1, 'User is required'),
  walletAddress: z.string().trim().min(32, 'Wallet address is too short').max(64, 'Wallet address is too long'),
  label: z.string().trim().optional().or(z.literal('')),
  isPrimary: booleanInputSchema.optional().default(false),
});
