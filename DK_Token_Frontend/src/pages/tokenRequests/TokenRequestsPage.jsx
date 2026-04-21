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
import usePagination from '../../hooks/usePagination';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { usersApi } from '../../modules/users/users.api';
import { REQUEST_STATUS_OPTIONS, REQUEST_TYPE_OPTIONS } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';
import { formatAmount, truncateMiddle } from '../../utils/format';

function TokenRequestsPage() {
  const navigate = useNavigate();
  const { setPage, setLimit, paginationQuery } = usePagination();
  const [filters, setFilters] = useState({
    status: '',
    requestType: '',
    tokenMintAddress: '',
    makerUserId: '',
    checkerUserId: '',
  });
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const [requestsResponse, usersResponse] = await Promise.all([
          tokenRequestsApi.list({ ...filters, ...paginationQuery }),
          usersApi.list({ page: 1, limit: 100 }),
        ]);
        setRequests(requestsResponse.data.items);
        setPagination(requestsResponse.data.pagination);
        setUsers(usersResponse.data.items);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load token requests.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [filters, paginationQuery.page, paginationQuery.limit]);

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
    { key: 'tokenMintAddress', label: 'Token Mint', render: (row) => truncateMiddle(row.tokenMintAddress, 8, 6) },
    { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatAmount(row.amount) },
    { key: 'sourceWallet', label: 'Source', render: (row) => row.sourceWallet?.label || '-' },
    { key: 'destinationWallet', label: 'Destination', render: (row) => row.destinationWallet?.label || '-' },
    { key: 'makerUser', label: 'Maker', render: (row) => row.makerUser?.fullName || '-' },
    { key: 'checkerUser', label: 'Checker', render: (row) => row.checkerUser?.fullName || '-' },
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
      render: (row) => <Button onClick={() => navigate(`/token-requests/${row.id}`)} size="small" variant="text">View</Button>,
    },
  ], [navigate]);

  if (loading && !requests.length) {
    return <LoadingScreen message="Loading token requests..." />;
  }

  if (error && !requests.length) {
    return <ErrorState description={error} onAction={() => window.location.reload()} />;
  }

  return (
    <Stack spacing={3}>
      <PageHeader subtitle="Monitor requests across the full off-chain workflow." title="Token Requests" />
      <SearchFilters>
        <TextField
          label="Mint Address"
          onChange={(event) => setFilters((current) => ({ ...current, tokenMintAddress: event.target.value }))}
          value={filters.tokenMintAddress}
        />
        <TextField
          label="Status"
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          select
          value={filters.status}
        >
          <MenuItem value="">All</MenuItem>
          {REQUEST_STATUS_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
        <TextField
          label="Request Type"
          onChange={(event) => setFilters((current) => ({ ...current, requestType: event.target.value }))}
          select
          value={filters.requestType}
        >
          <MenuItem value="">All</MenuItem>
          {REQUEST_TYPE_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
        <TextField
          label="Maker"
          onChange={(event) => setFilters((current) => ({ ...current, makerUserId: event.target.value }))}
          select
          value={filters.makerUserId}
        >
          <MenuItem value="">All</MenuItem>
          {users.map((user) => <MenuItem key={user.id} value={user.id}>{user.fullName}</MenuItem>)}
        </TextField>
        <Button
          onClick={() => setFilters({ status: '', requestType: '', tokenMintAddress: '', makerUserId: '', checkerUserId: '' })}
          variant="outlined"
        >
          Reset Filters
        </Button>
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

export default TokenRequestsPage;
