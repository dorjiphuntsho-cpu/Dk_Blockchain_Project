import { z } from 'zod';

export const bankUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Bank name is required'),
  binNumber: z.string().trim().optional().nullable(),
  panNumber: z.string().trim().optional().nullable(),
  treasuryWalletAddress: z.string().trim().min(32, 'Treasury wallet address is too short').max(64, 'Treasury wallet address is too long').optional().nullable(),
  supportsBtn: z.boolean(),
  supportsBipsSettlement: z.boolean(),
  isIssuer: z.boolean(),
  isActive: z.boolean(),
});

export const bankAccountSchema = z.object({
  accountType: z.enum(['RESERVE', 'BIPS_SETTLEMENT', 'OTHER']),
  accountName: z.string().trim().min(1, 'Account name is required'),
  accountNumber: z.string().trim().min(1, 'Account number is required'),
  currency: z.string().trim().min(1, 'Currency is required'),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
  remarks: z.string().trim().optional().nullable(),
});

export const bankTokenAccountSchema = z.object({
  mintAddress: z.string().trim().min(32, 'Mint address is required').max(64, 'Mint address is too long'),
  treasuryWalletAddress: z.string().trim().min(32, 'Treasury wallet address is required').max(64, 'Treasury wallet address is too long'),
  tokenAccountAddress: z.string().trim().min(32, 'Token account address is required').max(64, 'Token account address is too long'),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
  remarks: z.string().trim().optional().nullable(),
});
