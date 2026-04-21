import { REQUEST_STATUSES, REQUEST_TYPES } from './constants';

export const statusConfig = {
  [REQUEST_STATUSES.DRAFT]: { label: 'Draft', tone: 'neutral' },
  [REQUEST_STATUSES.PENDING_APPROVAL]: { label: 'Pending Approval', tone: 'warning' },
  [REQUEST_STATUSES.APPROVED]: { label: 'Approved', tone: 'primary' },
  [REQUEST_STATUSES.REJECTED]: { label: 'Rejected', tone: 'rejected' },
  [REQUEST_STATUSES.READY_FOR_EXECUTION]: { label: 'Ready for Execution', tone: 'secondary' },
  [REQUEST_STATUSES.EXECUTED]: { label: 'Executed', tone: 'success' },
  [REQUEST_STATUSES.FAILED]: { label: 'Failed', tone: 'error' },
};

export const requestTypeConfig = {
  [REQUEST_TYPES.MINT]: { label: 'Mint', tone: 'success' },
  [REQUEST_TYPES.TRANSFER]: { label: 'Transfer', tone: 'primary' },
  [REQUEST_TYPES.BURN]: { label: 'Burn', tone: 'burn' },
};
