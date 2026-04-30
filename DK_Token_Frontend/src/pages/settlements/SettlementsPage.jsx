import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import SearchFilters from '../../components/common/SearchFilters';
import StatusChip from '../../components/common/StatusChip';
import TypeChip from '../../components/common/TypeChip';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import usePagination from '../../hooks/usePagination';
import { settlementsApi } from '../../modules/settlements/settlements.api';
import {
  settlementModeOptions,
  settlementStatusOptions,
  settlementRequestTypeOptions,
} from '../../modules/settlements/settlements.schemas';
import { formatDateTime } from '../../utils/date';
import { formatAmount } from '../../utils/format';

function SettlementsPage() {
  const navigate = useNavigate();
  const { setPage, setLimit, paginationQuery } = usePagination();
  const [filters, setFilters] = useState({
    requestType: '',
    settlementMode: '',
    status: '',
    requestId: '',
  });
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSettlements = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await settlementsApi.list({
        ...filters,
        ...paginationQuery,
      });
      setRows(response.data.items);
      setPagination(response.data.pagination);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load settlements.');
    } finally {
      setLoading(false);
    }
  }, [filters, paginationQuery]);

  useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);

  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'Settlement',
      render: (row) => (
        <RouterLink className="font-medium text-sky-400 hover:text-sky-300" to={`/settlements/${row.id}`}>
          {row.id.slice(0, 8)}...
        </RouterLink>
      ),
    },
    {
      key: 'requestType',
      label: 'Type',
      render: (row) => <TypeChip value={row.requestType} />,
    },
    {
      key: 'settlementMode',
      label: 'Mode',
      render: (row) => row.settlementMode?.replaceAll('_', ' ') || '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusChip value={row.status} />,
    },
    {
      key: 'sourceBank',
      label: 'Source',
      render: (row) => row.sourceBank?.name || '-',
    },
    {
      key: 'destinationBank',
      label: 'Destination',
      render: (row) => row.destinationBank?.name || row.beneficiaryBankCode || '-',
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (row) => formatAmount(row.amount),
    },
    {
      key: 'requestId',
      label: 'Request ID',
      render: (row) => row.requestId || '-',
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      render: (row) => formatDateTime(row.updatedAt),
    },
  ], []);

  if (loading && !rows.length) {
    return <LoadingScreen message="Loading settlements..." />;
  }

  if (error && !rows.length) {
    return <ErrorState description={error} onAction={loadSettlements} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settlements"
        subtitle="Monitor reserve issuance, interbank BTN transfers, and BIPS-routed fiat fallback requests."
        action={{
          label: 'Create Settlement',
          onClick: () => navigate('/settlements/new'),
        }}
      />

      <SearchFilters
        actions={(
          <Button
            onClick={() => setFilters({ requestType: '', settlementMode: '', status: '', requestId: '' })}
            variant="outline"
          >
            Reset Filters
          </Button>
        )}
      >
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Type</span>
          <Select value={filters.requestType} onChange={(event) => setFilters((current) => ({ ...current, requestType: event.target.value }))}>
            <option value="">All</option>
            {settlementRequestTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Mode</span>
          <Select value={filters.settlementMode} onChange={(event) => setFilters((current) => ({ ...current, settlementMode: event.target.value }))}>
            <option value="">All</option>
            {settlementModeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Status</span>
          <Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">All</option>
            {settlementStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Request ID</span>
          <Input value={filters.requestId} onChange={(event) => setFilters((current) => ({ ...current, requestId: event.target.value }))} />
        </label>
      </SearchFilters>

      <AppTable
        columns={columns}
        rows={rows}
        pagination={pagination}
        loading={loading}
        error={error}
        onRetry={loadSettlements}
        onPageChange={setPage}
        onRowsPerPageChange={setLimit}
        onRowClick={(row) => navigate(`/settlements/${row.id}`)}
        minWidth={1120}
      />
    </div>
  );
}

export default SettlementsPage;
