import { Link as RouterLink } from 'react-router-dom';

import AppTable from '../common/AppTable';
import StatusChip from '../common/StatusChip';
import TypeChip from '../common/TypeChip';
import { formatDateTime } from '../../utils/date';
import { formatAmount, truncateMiddle } from '../../utils/format';

function RecentRequestsTable({ rows = [], onRowClick }) {
  return (
    <AppTable
      columns={[
        {
          key: 'id',
          label: 'Request ID',
          width: 170,
          render: (row) => (
            <RouterLink className="font-medium text-white hover:text-zinc-200" to={`/token-requests/${row.id}`}>
              {truncateMiddle(row.id, 10, 5)}
            </RouterLink>
          ),
        },
        {
          key: 'requestType',
          label: 'Type',
          width: 120,
          render: (row) => <TypeChip value={row.requestType} />,
        },
        {
          key: 'amount',
          label: 'Amount',
          align: 'right',
          width: 120,
          render: (row) => formatAmount(row.amount),
        },
        {
          key: 'status',
          label: 'Status',
          width: 180,
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'createdAt',
          label: 'Created',
          width: 180,
          render: (row) => <span className="text-sm text-zinc-500">{formatDateTime(row.createdAt)}</span>,
        },
      ]}
      emptyDescription="Recent request activity will appear here once token operations are created."
      minWidth={760}
      onRowClick={onRowClick}
      pagination={null}
      rows={rows}
    />
  );
}

export default RecentRequestsTable;
