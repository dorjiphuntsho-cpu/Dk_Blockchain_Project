import { REQUEST_STATUSES } from '../../utils/constants';

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
      label: 'Submitted for Approval',
      completed: request?.status !== REQUEST_STATUSES.DRAFT,
      timestamp: request?.status !== REQUEST_STATUSES.DRAFT ? request?.updatedAt || request?.createdAt : null,
    },
    {
      key: REQUEST_STATUSES.APPROVED,
      label: 'Approved',
      completed: [REQUEST_STATUSES.APPROVED, REQUEST_STATUSES.READY_FOR_EXECUTION, REQUEST_STATUSES.EXECUTED, REQUEST_STATUSES.FAILED].includes(request?.status),
      timestamp: request?.approvedAt || null,
    },
    {
      key: REQUEST_STATUSES.READY_FOR_EXECUTION,
      label: 'Ready for Execution',
      completed: [REQUEST_STATUSES.READY_FOR_EXECUTION, REQUEST_STATUSES.EXECUTED, REQUEST_STATUSES.FAILED].includes(request?.status),
      timestamp:
        [REQUEST_STATUSES.READY_FOR_EXECUTION, REQUEST_STATUSES.EXECUTED, REQUEST_STATUSES.FAILED].includes(request?.status)
          ? request?.updatedAt || null
          : null,
    },
    {
      key: REQUEST_STATUSES.EXECUTED,
      label: 'Execution Recorded',
      completed: [REQUEST_STATUSES.EXECUTED, REQUEST_STATUSES.FAILED].includes(request?.status),
      timestamp: request?.executedAt || null,
    },
  ];
}
