import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import SearchFilters from '../../components/common/SearchFilters';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import usePagination from '../../hooks/usePagination';
import { banksApi } from '../../modules/banks/banks.api';

function BanksPage() {
  const navigate = useNavigate();
  const { setPage, setLimit, paginationQuery } = usePagination();
  const [filters, setFilters] = useState({
    code: '',
    name: '',
    supportsBtn: '',
    isIssuer: '',
    isActive: '',
  });
  const [banks, setBanks] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadBanks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await banksApi.list({ ...filters, ...paginationQuery });
      setBanks(response.data.items);
      setPagination(response.data.pagination);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load banks.');
    } finally {
      setLoading(false);
    }
  }, [filters, paginationQuery]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await banksApi.list({ ...filters, ...paginationQuery });
        setBanks(response.data.items);
        setPagination(response.data.pagination);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load banks.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [filters, paginationQuery]);

  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'Bank',
      render: (row) => (
        <RouterLink className="font-medium text-sky-400 hover:text-sky-300" to={`/banks/${row.id}`}>
          {row.name}
        </RouterLink>
      ),
    },
    { key: 'code', label: 'Code' },
    { key: 'binNumber', label: 'BIN', render: (row) => row.binNumber || '-' },
    { key: 'panNumber', label: 'PAN', render: (row) => row.panNumber || '-' },
    {
      key: 'supportsBtn',
      label: 'BTN',
      render: (row) => <Badge tone={row.supportsBtn ? 'emerald' : 'slate'}>{row.supportsBtn ? 'Enabled' : 'Disabled'}</Badge>,
    },
    {
      key: 'supportsBipsSettlement',
      label: 'BIPS',
      render: (row) => (
        <Badge tone={row.supportsBipsSettlement ? 'blue' : 'slate'}>
          {row.supportsBipsSettlement ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'isIssuer',
      label: 'Issuer',
      render: (row) => <Badge tone={row.isIssuer ? 'amber' : 'slate'}>{row.isIssuer ? 'Issuer' : 'Standard'}</Badge>,
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
        <div className="flex justify-end">
          <Button onClick={() => navigate(`/banks/${row.id}`)} size="sm" variant="ghost">Manage</Button>
        </div>
      ),
    },
  ], [navigate]);

  if (loading && !banks.length) {
    return <LoadingScreen message="Loading banks..." />;
  }

  if (error && !banks.length) {
    return <ErrorState description={error} onAction={loadBanks} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Manage bank master data, settlement accounts, and BTN treasury account capability."
        title="Banks"
      />

      <SearchFilters
        actions={(
          <Button onClick={() => setFilters({ code: '', name: '', supportsBtn: '', isIssuer: '', isActive: '' })} variant="outline">
            Reset Filters
          </Button>
        )}
      >
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Bank code</span>
          <Input onChange={(event) => setFilters((current) => ({ ...current, code: event.target.value }))} value={filters.code} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Bank name</span>
          <Input onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))} value={filters.name} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">BTN support</span>
          <Select onChange={(event) => setFilters((current) => ({ ...current, supportsBtn: event.target.value }))} value={filters.supportsBtn}>
            <option value="">All</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Issuer</span>
          <Select onChange={(event) => setFilters((current) => ({ ...current, isIssuer: event.target.value }))} value={filters.isIssuer}>
            <option value="">All</option>
            <option value="true">Issuer</option>
            <option value="false">Non-issuer</option>
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Status</span>
          <Select onChange={(event) => setFilters((current) => ({ ...current, isActive: event.target.value }))} value={filters.isActive}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </label>
      </SearchFilters>

      <AppTable
        columns={columns}
        error={error}
        loading={loading}
        onPageChange={setPage}
        onRetry={loadBanks}
        onRowClick={(row) => navigate(`/banks/${row.id}`)}
        onRowsPerPageChange={setLimit}
        pagination={pagination}
        rows={banks}
      />
    </div>
  );
}

export default BanksPage;
