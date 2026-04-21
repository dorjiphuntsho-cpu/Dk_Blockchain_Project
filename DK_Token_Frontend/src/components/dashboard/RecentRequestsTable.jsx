import { Link, Typography } from '@mui/material';
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
            <Link
              component={RouterLink}
              sx={{ fontWeight: 700, textDecoration: 'none' }}
              to={`/token-requests/${row.id}`}
            >
              {truncateMiddle(row.id, 10, 5)}
            </Link>
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
          render: (row) => (
            <Typography color="text.secondary" variant="body2">
              {formatDateTime(row.createdAt)}
            </Typography>
          ),
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
