import { z } from 'zod';

import { REQUEST_TYPES, REQUEST_STATUSES } from '../../utils/constants';

export const tokenRequestSchema = z
  .object({
    requestType: z.enum([REQUEST_TYPES.MINT, REQUEST_TYPES.TRANSFER, REQUEST_TYPES.BURN]),
    tokenMintAddress: z.string().trim().min(32, 'Token mint address is required').max(64, 'Token mint address is too long'),
    amount: z.coerce.number().positive('Amount must be greater than zero'),
    sourceWalletId: z.preprocess((value) => value || null, z.string().nullable()),
    destinationWalletId: z.preprocess((value) => value || null, z.string().nullable()),
    remarks: z.string().trim().optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    if (value.requestType === REQUEST_TYPES.MINT && !value.destinationWalletId) {
      ctx.addIssue({
        code: 'custom',
        path: ['destinationWalletId'],
        message: 'Destination wallet is required for mint requests',
      });
    }

    if (value.requestType === REQUEST_TYPES.TRANSFER) {
      if (!value.sourceWalletId) {
        ctx.addIssue({
          code: 'custom',
          path: ['sourceWalletId'],
          message: 'Source wallet is required for transfer requests',
        });
      }

      if (!value.destinationWalletId) {
        ctx.addIssue({
          code: 'custom',
          path: ['destinationWalletId'],
          message: 'Destination wallet is required for transfer requests',
        });
      }

      if (value.sourceWalletId && value.destinationWalletId && value.sourceWalletId === value.destinationWalletId) {
        ctx.addIssue({
          code: 'custom',
          path: ['destinationWalletId'],
          message: 'Source and destination wallets cannot be the same',
        });
      }
    }

    if (value.requestType === REQUEST_TYPES.BURN && !value.sourceWalletId) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceWalletId'],
        message: 'Source wallet is required for burn requests',
      });
    }
  });

export const rejectionSchema = z.object({
  rejectionReason: z.string().trim().min(1, 'Rejection reason is required'),
  comment: z.string().trim().optional().or(z.literal('')),
});

export const executionSchema = z.object({
  status: z.enum([REQUEST_STATUSES.EXECUTED, REQUEST_STATUSES.FAILED]),
  txSignature: z.string().trim().optional().or(z.literal('')),
  explorerUrl: z.url('Enter a valid URL').optional().or(z.literal('')),
  executionError: z.string().trim().optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.status === REQUEST_STATUSES.FAILED && !value.executionError) {
    ctx.addIssue({
      code: 'custom',
      path: ['executionError'],
      message: 'Execution error is required when status is FAILED',
    });
  }
});
