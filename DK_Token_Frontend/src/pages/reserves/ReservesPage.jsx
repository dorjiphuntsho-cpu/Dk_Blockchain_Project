import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import SearchFilters from '../../components/common/SearchFilters';
import StatusChip from '../../components/common/StatusChip';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import usePagination from '../../hooks/usePagination';
import { reservesApi } from '../../modules/reserves/reserves.api';
import { reserveStatusOptions } from '../../modules/reserves/reserves.schemas';
import { formatDateTime } from '../../utils/date';
import { formatAmount } from '../../utils/format';

function ReservesPage() {
  const navigate = useNavigate();
  const { setPage, setLimit, paginationQuery } = usePagination();
  const [filters, setFilters] = useState({
    status: '',
    referenceType: '',
    bankId: '',
  });
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReserves = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await reservesApi.list({
        ...filters,
        ...paginationQuery,
      });
      setRows(response.data.items);
      setPagination(response.data.pagination);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load reserves.');
    } finally {
      setLoading(false);
    }
  }, [filters, paginationQuery]);

  useEffect(() => {
    void loadReserves();
  }, [loadReserves]);

  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'Reserve',
      render: (row) => (
        <RouterLink className="font-medium text-sky-400 hover:text-sky-300" to={`/reserves/${row.id}`}>
          {row.id.slice(0, 8)}...
        </RouterLink>
      ),
    },
    {
      key: 'bank',
      label: 'Bank',
      render: (row) => row.bank?.name || '-',
    },
    {
      key: 'referenceType',
      label: 'Source',
    },
    {
      key: 'referenceId',
      label: 'Reference',
      render: (row) => row.referenceId || '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusChip value={row.status} />,
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (row) => formatAmount(row.amount),
    },
    {
      key: 'availableAmount',
      label: 'Available',
      align: 'right',
      render: (row) => formatAmount(row.availableAmount),
    },
    {
      key: 'approvedAt',
      label: 'Approved',
      render: (row) => formatDateTime(row.approvedAt),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => formatDateTime(row.createdAt),
    },
  ], []);

  if (loading && !rows.length) {
    return <LoadingScreen message="Loading reserves..." />;
  }

  if (error && !rows.length) {
    return <ErrorState description={error} onAction={loadReserves} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reserves"
        subtitle="Review payment-backed reserve capacity for DK Bank before reserve-backed BTN issuance."
      />

      <SearchFilters
        actions={(
          <Button
            onClick={() => setFilters({ status: '', referenceType: '', bankId: '' })}
            variant="outline"
          >
            Reset Filters
          </Button>
        )}
      >
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Status</span>
          <Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">All</option>
            {reserveStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Reference Type</span>
          <Input value={filters.referenceType} onChange={(event) => setFilters((current) => ({ ...current, referenceType: event.target.value }))} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Bank ID</span>
          <Input value={filters.bankId} onChange={(event) => setFilters((current) => ({ ...current, bankId: event.target.value }))} />
        </label>
      </SearchFilters>

      <AppTable
        columns={columns}
        rows={rows}
        pagination={pagination}
        loading={loading}
        error={error}
        onRetry={loadReserves}
        onPageChange={setPage}
        onRowsPerPageChange={setLimit}
        onRowClick={(row) => navigate(`/reserves/${row.id}`)}
        minWidth={1120}
        emptyTitle="No reserves found"
        emptyDescription="Payment-backed reserve entries will appear here after payment confirmation."
      />
    </div>
  );
}

export default ReservesPage;
