import { EXECUTION_MODES, ON_CHAIN_PENDING_STATUSES, REQUEST_STATUSES } from '../../utils/constants';

export function getStatusTimeline(request) {
  return [
    {
      key: REQUEST_STATUSES.DRAFT,
      label: 'Draft Created',
      completed: Boolean(request?.createdAt),
      timestamp: request?.createdAt || null,
    },
    {
      key: REQUEST_STATUSES.PENDING_APPROVAL,
      label: 'Waiting for Checker Wallet Approval',
      completed: request?.status !== REQUEST_STATUSES.DRAFT,
      timestamp: request?.status !== REQUEST_STATUSES.DRAFT ? request?.makerInitiatedAt || request?.updatedAt || request?.createdAt : null,
    },
    {
      key: 'FINAL_DECISION',
      label: 'Checker Decision',
      completed: [REQUEST_STATUSES.APPROVED, REQUEST_STATUSES.REJECTED].includes(request?.status),
      timestamp: request?.approvedAt || request?.rejectedAt || null,
    },
  ];
}

export function getNextActorMessage(request, executionPayload = null) {
  if (!request) {
    return '';
  }

  if (request.status === REQUEST_STATUSES.EXECUTED) {
    return 'Executed';
  }

  if (request.status === REQUEST_STATUSES.REJECTED) {
    return 'Rejected';
  }

  if (request.status === REQUEST_STATUSES.PENDING_APPROVAL) {
    return 'Waiting for checker wallet approval';
  }

  if (request.status === REQUEST_STATUSES.DRAFT) {
    return 'Waiting for maker wallet signature';
  }

  if (request.status === REQUEST_STATUSES.APPROVED && executionPayload?.walletInitiation?.supported && !executionPayload?.walletInitiation?.recorded) {
    return 'Waiting for maker wallet signature';
  }

  if (ON_CHAIN_PENDING_STATUSES.includes(request.status)) {
    if (executionPayload?.executionMode === EXECUTION_MODES.BROWSER_WALLET) {
      return executionPayload?.walletInitiation?.recorded
        ? 'Waiting for checker wallet approval'
        : 'Waiting for maker wallet signature';
    }

    return 'Waiting for execution';
  }

  if (request.status === REQUEST_STATUSES.FAILED) {
    return 'Execution failed';
  }

  return 'Waiting for execution';
}
