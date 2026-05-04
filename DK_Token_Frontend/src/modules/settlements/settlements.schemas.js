import { z } from 'zod';

import { REQUEST_STATUSES, REQUEST_TYPES, SETTLEMENT_MODES } from '../../utils/constants';

export const settlementRequestTypeOptions = [
  { label: 'Reserve Mint', value: REQUEST_TYPES.RESERVE_MINT },
  { label: 'Replenishment Mint', value: REQUEST_TYPES.REPLENISHMENT_MINT },
  { label: 'Interbank Transfer', value: REQUEST_TYPES.INTERBANK_TRANSFER },
  { label: 'Redemption', value: REQUEST_TYPES.REDEMPTION },
];

export const settlementModeOptions = [
  { label: 'BTN On-Chain', value: SETTLEMENT_MODES.ON_CHAIN_BTN },
  { label: 'BIPS Fiat', value: SETTLEMENT_MODES.BIPS_FIAT },
];

export const settlementStatusOptions = [
  REQUEST_STATUSES.DRAFT,
  REQUEST_STATUSES.PENDING_APPROVAL,
  REQUEST_STATUSES.APPROVED,
  REQUEST_STATUSES.INQUIRY_FAILED,
  REQUEST_STATUSES.BIPS_PENDING,
  REQUEST_STATUSES.SETTLED,
  REQUEST_STATUSES.MANUAL_REVIEW,
  REQUEST_STATUSES.FAILED,
  REQUEST_STATUSES.CANCELLED,
].map((value) => ({
  label: value.replaceAll('_', ' '),
  value,
}));

const nullableTrimmed = z.string().trim().optional().nullable();
const requiredTrimmed = z.string().trim().min(1, 'This field is required');
const amountSchema = z.string().trim().min(1, 'Amount is required');
const addressSchema = z.string().trim().min(32, 'A valid address is required').max(64, 'Address is too long');

export const reserveMintSettlementSchema = z.object({
  sourceBankId: requiredTrimmed,
  reserveLedgerId: nullableTrimmed,
  tokenMintAddress: addressSchema,
  amount: amountSchema,
  transferPurpose: nullableTrimmed,
});

export const replenishmentMintSettlementSchema = reserveMintSettlementSchema.extend({});

export const interbankTransferSettlementSchema = z.object({
  sourceBankId: requiredTrimmed,
  destinationBankId: requiredTrimmed,
  tokenMintAddress: addressSchema,
  amount: amountSchema,
  transferPurpose: requiredTrimmed,
  requestId: nullableTrimmed,
  beneficiaryAccountName: nullableTrimmed,
  beneficiaryAccountNumber: nullableTrimmed,
  beneficiaryBankCode: nullableTrimmed,
  sourceAccountName: nullableTrimmed,
  sourceAccountNumber: nullableTrimmed,
});

export const redemptionSettlementSchema = z.object({
  sourceBankId: requiredTrimmed,
  destinationBankId: nullableTrimmed,
  tokenMintAddress: addressSchema,
  amount: amountSchema,
  transferPurpose: requiredTrimmed,
  requestId: requiredTrimmed,
  beneficiaryAccountName: requiredTrimmed,
  beneficiaryAccountNumber: requiredTrimmed,
  beneficiaryBankCode: requiredTrimmed,
  sourceAccountName: requiredTrimmed,
  sourceAccountNumber: requiredTrimmed,
});

export function getSettlementTimeline(settlement) {
  return [
    {
      key: REQUEST_STATUSES.DRAFT,
      label: 'Created',
      completed: Boolean(settlement?.createdAt),
      timestamp: settlement?.createdAt || null,
    },
    {
      key: REQUEST_STATUSES.PENDING_APPROVAL,
      label: 'Pending Approval',
      completed: [
        REQUEST_STATUSES.PENDING_APPROVAL,
        REQUEST_STATUSES.APPROVED,
        REQUEST_STATUSES.READY_FOR_EXECUTION,
        REQUEST_STATUSES.BIPS_PENDING,
        REQUEST_STATUSES.SETTLED,
        REQUEST_STATUSES.FAILED,
        REQUEST_STATUSES.MANUAL_REVIEW,
      ].includes(settlement?.status),
      timestamp: settlement?.makerInitiatedAt || settlement?.updatedAt || null,
    },
    {
      key: REQUEST_STATUSES.BIPS_PENDING,
      label: 'BIPS Processing',
      completed: [
        REQUEST_STATUSES.BIPS_PENDING,
        REQUEST_STATUSES.SETTLED,
        REQUEST_STATUSES.MANUAL_REVIEW,
      ].includes(settlement?.status),
      timestamp: settlement?.executedAt || null,
    },
    {
      key: REQUEST_STATUSES.SETTLED,
      label: 'Final Outcome',
      completed: [
        REQUEST_STATUSES.SETTLED,
        REQUEST_STATUSES.FAILED,
        REQUEST_STATUSES.MANUAL_REVIEW,
        REQUEST_STATUSES.CANCELLED,
      ].includes(settlement?.status),
      timestamp:
        settlement?.settledAt
        || settlement?.rejectedAt
        || settlement?.executedAt
        || null,
    },
  ];
}
