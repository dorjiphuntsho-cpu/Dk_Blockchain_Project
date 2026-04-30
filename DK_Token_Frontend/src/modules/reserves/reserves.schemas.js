import { z } from 'zod';

export const reserveStatusOptions = [
  'PENDING',
  'APPROVED',
  'LOCKED',
  'CONSUMED',
  'RELEASED',
  'REJECTED',
].map((value) => ({
  label: value.replaceAll('_', ' '),
  value,
}));

const requiredTrimmed = z.string().trim().min(1, 'This field is required');

export const rejectReserveSchema = z.object({
  rejectionReason: requiredTrimmed,
});

export function formatReserveLabel(reserve) {
  if (!reserve) {
    return '-';
  }

  const amount = Number(reserve.availableAmount ?? reserve.amount ?? 0);
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(amount);

  return `${reserve.referenceType} / ${reserve.referenceId} / Available ${formattedAmount} ${reserve.currency || 'BTN'}`;
}
