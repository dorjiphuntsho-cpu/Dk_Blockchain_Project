import { REQUEST_STATUSES, REQUEST_TYPES } from './constants';

export const statusConfig = {
  [REQUEST_STATUSES.DRAFT]: { label: 'Draft', tone: 'neutral' },
  [REQUEST_STATUSES.PENDING_APPROVAL]: { label: 'Pending Approval', tone: 'warning' },
  [REQUEST_STATUSES.APPROVED]: { label: 'Approved', tone: 'primary' },
  [REQUEST_STATUSES.INQUIRY_FAILED]: { label: 'Inquiry Failed', tone: 'error' },
  [REQUEST_STATUSES.REJECTED]: { label: 'Rejected', tone: 'rejected' },
  [REQUEST_STATUSES.READY_FOR_EXECUTION]: { label: 'In Progress', tone: 'secondary' },
  [REQUEST_STATUSES.ON_CHAIN_PENDING]: { label: 'In Progress', tone: 'secondary' },
  [REQUEST_STATUSES.BIPS_PENDING]: { label: 'BIPS Pending', tone: 'secondary' },
  [REQUEST_STATUSES.SETTLED]: { label: 'Settled', tone: 'success' },
  [REQUEST_STATUSES.MANUAL_REVIEW]: { label: 'Manual Review', tone: 'warning' },
  [REQUEST_STATUSES.EXECUTED]: { label: 'Executed', tone: 'success' },
  [REQUEST_STATUSES.FAILED]: { label: 'Failed', tone: 'error' },
};

export const requestTypeConfig = {
  [REQUEST_TYPES.MINT]: { label: 'Mint', tone: 'success' },
  [REQUEST_TYPES.TRANSFER]: { label: 'Transfer', tone: 'primary' },
  [REQUEST_TYPES.BURN]: { label: 'Burn', tone: 'burn' },
  [REQUEST_TYPES.RESERVE_MINT]: { label: 'Reserve Mint', tone: 'success' },
  [REQUEST_TYPES.REPLENISHMENT_MINT]: { label: 'Replenishment Mint', tone: 'success' },
  [REQUEST_TYPES.INTERBANK_TRANSFER]: { label: 'Interbank Transfer', tone: 'primary' },
  [REQUEST_TYPES.REDEMPTION]: { label: 'Redemption', tone: 'burn' },
};
