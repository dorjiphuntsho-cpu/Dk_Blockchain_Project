import { Button, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import SearchFilters from '../../components/common/SearchFilters';
import StatusChip from '../../components/common/StatusChip';
import TypeChip from '../../components/common/TypeChip';
import useAuth from '../../hooks/useAuth';
import usePagination from '../../hooks/usePagination';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { REQUEST_STATUS_OPTIONS } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';
import { formatAmount, truncateMiddle } from '../../utils/format';

function MyTokenRequestsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setPage, setLimit, paginationQuery } = usePagination();
  const [filters, setFilters] = useState({ status: '' });
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const response = await tokenRequestsApi.list({
          ...filters,
          ...paginationQuery,
          makerUserId: user.id,
        });
        setRequests(response.data.items);
        setPagination(response.data.pagination);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load your requests.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [filters, paginationQuery.page, paginationQuery.limit, user.id]);

  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'Request ID',
      render: (row) => (
        <Link component={RouterLink} sx={{ fontWeight: 700, textDecoration: 'none' }} to={`/token-requests/${row.id}`}>
          {truncateMiddle(row.id, 10, 5)}
        </Link>
      ),
    },
    { key: 'requestType', label: 'Type', render: (row) => <TypeChip value={row.requestType} /> },
    { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatAmount(row.amount) },
    { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => (
        <Typography color="text.secondary" variant="body2">
          {formatDateTime(row.createdAt)}
        </Typography>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      disableRowClick: true,
      render: (row) => (
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button onClick={() => navigate(`/token-requests/${row.id}`)} size="small" variant="text">View</Button>
          {row.status === 'DRAFT' ? (
            <Button onClick={() => navigate('/token-requests/new', { state: { request: row } })} size="small" variant="outlined">
              Edit
            </Button>
          ) : null}
        </Stack>
      ),
    },
  ], [navigate]);

  if (loading && !requests.length) {
    return <LoadingScreen message="Loading your requests..." />;
  }

  if (error && !requests.length) {
    return <ErrorState description={error} onAction={() => window.location.reload()} />;
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        action={{ label: 'Create Request', onClick: () => navigate('/token-requests/new') }}
        subtitle="Track draft, submitted, and completed requests created by you."
        title="My Token Requests"
      />
      <SearchFilters>
        <TextField
          label="Status"
          onChange={(event) => setFilters({ status: event.target.value })}
          select
          value={filters.status}
        >
          <MenuItem value="">All</MenuItem>
          {REQUEST_STATUS_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
        <Button onClick={() => setFilters({ status: '' })} variant="outlined">Reset Filters</Button>
      </SearchFilters>
      <AppTable
        columns={columns}
        error={error}
        loading={loading}
        onRowClick={(row) => navigate(`/token-requests/${row.id}`)}
        onPageChange={setPage}
        onRowsPerPageChange={setLimit}
        onRetry={() => window.location.reload()}
        pagination={pagination}
        rows={requests}
      />
    </Stack>
  );
}

export default MyTokenRequestsPage;
