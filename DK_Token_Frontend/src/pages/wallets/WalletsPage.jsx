import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import AppTable from '../../components/common/AppTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import SearchFilters from '../../components/common/SearchFilters';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import usePagination from '../../hooks/usePagination';
import { usersApi } from '../../modules/users/users.api';
import { walletsApi } from '../../modules/wallets/wallets.api';
import { getErrorMessage } from '../../utils/error';
import { truncateMiddle } from '../../utils/format';

function WalletsPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { setPage, setLimit, paginationQuery } = usePagination();
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
        <RouterLink className="font-medium text-sky-400 hover:text-sky-300" to={`/wallets/${row.id}`}>
          {truncateMiddle(row.walletAddress, 8, 6)}
        </RouterLink>
      ),
    },
    { key: 'user', label: 'User', render: (row) => row.user?.fullName || '-' },
    { key: 'label', label: 'Label' },
    {
      key: 'isPrimary',
      label: 'Primary',
      render: (row) => <Badge tone={row.isPrimary ? 'blue' : 'slate'}>{row.isPrimary ? 'Primary' : 'Standard'}</Badge>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => <Badge tone={row.isActive ? 'emerald' : 'slate'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      disableRowClick: true,
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button onClick={() => navigate(`/wallets/${row.id}`)} size="sm" variant="ghost">View</Button>
          <Button onClick={() => setSelectedWallet(row)} size="sm" variant={row.isActive ? 'danger' : 'secondary'}>
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
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
    <div className="space-y-6">
      <PageHeader
        action={{ label: 'Create Wallet', onClick: () => navigate('/wallets/new') }}
        subtitle="Manage user-linked wallets and primary wallet selection."
        title="Wallets"
      />

      <SearchFilters
        actions={(
          <Button onClick={() => setFilters({ walletAddress: '', userId: '', isActive: '', isPrimary: '' })} variant="outline">
            Reset Filters
          </Button>
        )}
      >
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Search address</span>
          <Input
            onChange={(event) => setFilters((current) => ({ ...current, walletAddress: event.target.value }))}
            value={filters.walletAddress}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">User</span>
          <Select
            onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))}
            value={filters.userId}
          >
            <option value="">All</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.fullName}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Status</span>
          <Select
            onChange={(event) => setFilters((current) => ({ ...current, isActive: event.target.value }))}
            value={filters.isActive}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Primary</span>
          <Select
            onChange={(event) => setFilters((current) => ({ ...current, isPrimary: event.target.value }))}
            value={filters.isPrimary}
          >
            <option value="">All</option>
            <option value="true">Primary</option>
            <option value="false">Non-primary</option>
          </Select>
        </label>
      </SearchFilters>

      <AppTable
        columns={columns}
        error={error}
        loading={loading}
        onPageChange={setPage}
        onRetry={loadWallets}
        onRowClick={(row) => navigate(`/wallets/${row.id}`)}
        onRowsPerPageChange={setLimit}
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
    </div>
  );
}

export default WalletsPage;
