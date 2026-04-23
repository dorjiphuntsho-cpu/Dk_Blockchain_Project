import { Button, Chip, Link, MenuItem, Stack, TextField } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import AppTable from '../../components/common/AppTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import SearchFilters from '../../components/common/SearchFilters';
import usePagination from '../../hooks/usePagination';
import { usersApi } from '../../modules/users/users.api';
import { walletsApi } from '../../modules/wallets/wallets.api';
import { getErrorMessage } from '../../utils/error';
import { truncateMiddle } from '../../utils/format';

function WalletsPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { page, limit, setPage, setLimit, paginationQuery } = usePagination();
  const [filters, setFilters] = useState({ walletAddress: '', userId: '', isActive: '', isPrimary: '' });
  const [wallets, setWallets] = useState([]);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [statusChanging, setStatusChanging] = useState(false);

  async function loadWallets() {
    try {
      setLoading(true);
      setError('');
      const [walletResponse, userResponse] = await Promise.all([
        walletsApi.list({ ...filters, ...paginationQuery }),
        usersApi.list({ page: 1, limit: 100 }),
      ]);

      setWallets(walletResponse.data.items);
      setPagination(walletResponse.data.pagination);
      setUsers(userResponse.data.items);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load wallets.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWallets();
  }, [filters, paginationQuery.page, paginationQuery.limit]);

  const columns = useMemo(() => [
    {
      key: 'walletAddress',
      label: 'Wallet Address',
      render: (row) => (
        <Link component={RouterLink} sx={{ fontWeight: 700, textDecoration: 'none' }} to={`/wallets/${row.id}`}>
          {truncateMiddle(row.walletAddress, 8, 6)}
        </Link>
      ),
    },
    { key: 'user', label: 'User', render: (row) => row.user?.fullName || '-' },
    { key: 'label', label: 'Label' },
    {
      key: 'isPrimary',
      label: 'Primary',
      render: (row) => (
        <Chip
          label={row.isPrimary ? 'Primary' : 'Standard'}
          sx={{
            backgroundColor: row.isPrimary ? 'primary.light' : 'grey.100',
            color: row.isPrimary ? 'primary.dark' : 'text.secondary',
          }}
        />
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <Chip
          label={row.isActive ? 'Active' : 'Inactive'}
          sx={{
            backgroundColor: row.isActive ? 'success.light' : 'grey.200',
            color: row.isActive ? 'success.main' : 'text.secondary',
          }}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      disableRowClick: true,
      render: (row) => (
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button onClick={() => navigate(`/wallets/${row.id}`)} size="small" variant="text">View</Button>
          <Button color={row.isActive ? 'error' : 'success'} onClick={() => setSelectedWallet(row)} size="small" variant="outlined">
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </Stack>
      ),
    },
  ], [navigate]);

  if (loading && !wallets.length) {
    return <LoadingScreen message="Loading wallets..." />;
  }

  if (error && !wallets.length) {
    return <ErrorState description={error} onAction={loadWallets} />;
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        action={{ label: 'Create Wallet', onClick: () => navigate('/wallets/new') }}
        subtitle="Manage user-linked wallets and primary wallet selection."
        title="Wallets"
      />

      <SearchFilters>
        <TextField
          label="Search address"
          onChange={(event) => setFilters((current) => ({ ...current, walletAddress: event.target.value }))}
          value={filters.walletAddress}
        />
        <TextField
          label="User"
          onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))}
          select
          value={filters.userId}
        >
          <MenuItem value="">All</MenuItem>
          {users.map((user) => (
            <MenuItem key={user.id} value={user.id}>{user.fullName}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Status"
          onChange={(event) => setFilters((current) => ({ ...current, isActive: event.target.value }))}
          select
          value={filters.isActive}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>
        <TextField
          label="Primary"
          onChange={(event) => setFilters((current) => ({ ...current, isPrimary: event.target.value }))}
          select
          value={filters.isPrimary}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Primary</MenuItem>
          <MenuItem value="false">Non-primary</MenuItem>
        </TextField>
        <Button onClick={() => setFilters({ walletAddress: '', userId: '', isActive: '', isPrimary: '' })} variant="outlined">
          Reset Filters
        </Button>
      </SearchFilters>

      <AppTable
        columns={columns}
        error={error}
        loading={loading}
        onRowClick={(row) => navigate(`/wallets/${row.id}`)}
        onPageChange={setPage}
        onRowsPerPageChange={setLimit}
        onRetry={loadWallets}
        pagination={pagination}
        rows={wallets}
      />

      <ConfirmDialog
        confirmLabel={selectedWallet?.isActive ? 'Deactivate' : 'Activate'}
        description={`This will ${selectedWallet?.isActive ? 'deactivate' : 'activate'} this wallet.`}
        isLoading={statusChanging}
        onClose={() => setSelectedWallet(null)}
        onConfirm={async () => {
          try {
            setStatusChanging(true);
            await walletsApi.updateStatus(selectedWallet.id, !selectedWallet.isActive);
            enqueueSnackbar('Wallet status updated', { variant: 'success' });
            setSelectedWallet(null);
            loadWallets();
          } catch (statusError) {
            enqueueSnackbar(getErrorMessage(statusError, 'Unable to update wallet status'), { variant: 'error' });
          } finally {
            setStatusChanging(false);
          }
        }}
        open={Boolean(selectedWallet)}
        title="Confirm Wallet Status Change"
      />
    </Stack>
  );
}

export default WalletsPage;
