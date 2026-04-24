import { useEffect, useMemo, useState } from 'react';

import AppDrawer from '../../components/common/AppDrawer';
import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import SearchFilters from '../../components/common/SearchFilters';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import usePagination from '../../hooks/usePagination';
import { auditLogsApi } from '../../modules/auditLogs/auditLogs.api';
import { AUDIT_ACTIONS, ENTITY_TYPES } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';
import { truncateMiddle } from '../../utils/format';

function AuditLogsPage() {
  const { setPage, setLimit, paginationQuery } = usePagination();
  const [filters, setFilters] = useState({ entityType: '', action: '' });
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  async function loadLogs() {
    try {
      setLoading(true);
      setError('');
      const response = await auditLogsApi.list({ ...filters, ...paginationQuery });
      setLogs(response.data.items);
      setPagination(response.data.pagination);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load audit logs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [filters, paginationQuery.page, paginationQuery.limit]);

  const columns = useMemo(() => [
    { key: 'actorUser', label: 'Actor', render: (row) => row.actorUser?.fullName || 'System' },
    {
      key: 'entityType',
      label: 'Entity Type',
      render: (row) => <Badge>{row.entityType}</Badge>,
    },
    { key: 'entityId', label: 'Entity ID', render: (row) => truncateMiddle(row.entityId, 10, 6) },
    { key: 'action', label: 'Action', render: (row) => <Badge tone="blue">{row.action}</Badge> },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => <span className="text-zinc-400">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'metadata',
      label: 'Metadata Preview',
      render: (row) => (
        <span className="block max-w-60 truncate text-zinc-400">{JSON.stringify(row.metadata)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      disableRowClick: true,
      render: (row) => <Button onClick={() => setSelectedLog(row)} size="sm" variant="ghost">View</Button>,
    },
  ], []);

  if (loading && !logs.length) {
    return <LoadingScreen message="Loading audit logs..." />;
  }

  if (error && !logs.length) {
    return <ErrorState description={error} onAction={loadLogs} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Inspect system activity for users, wallets, and token requests." title="Audit Logs" />
      <SearchFilters
        actions={(
          <Button onClick={() => setFilters({ entityType: '', action: '' })} variant="outline">Reset Filters</Button>
        )}
      >
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Entity Type</span>
          <Select
            onChange={(event) => setFilters((current) => ({ ...current, entityType: event.target.value }))}
            value={filters.entityType}
          >
            <option value="">All</option>
            {Object.values(ENTITY_TYPES).map((type) => <option key={type} value={type}>{type}</option>)}
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Action</span>
          <Select
            onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
            value={filters.action}
          >
            <option value="">All</option>
            {Object.values(AUDIT_ACTIONS).map((action) => <option key={action} value={action}>{action}</option>)}
          </Select>
        </label>
      </SearchFilters>
      <AppTable
        columns={columns}
        error={error}
        loading={loading}
        onPageChange={setPage}
        onRetry={loadLogs}
        onRowClick={(row) => setSelectedLog(row)}
        onRowsPerPageChange={setLimit}
        pagination={pagination}
        rows={logs}
      />

      <AppDrawer onClose={() => setSelectedLog(null)} open={Boolean(selectedLog)} title="Audit Log Details">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Actor</p>
              <p>{selectedLog?.actorUser?.fullName || 'System'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Entity Type</p>
              <p>{selectedLog?.entityType}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Entity ID</p>
              <p className="break-all font-mono text-xs text-zinc-300">{selectedLog?.entityId}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Action</p>
              <p>{selectedLog?.action}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Created</p>
              <p>{formatDateTime(selectedLog?.createdAt)}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Metadata</p>
            <pre className="overflow-x-auto rounded-lg border border-white/10 bg-zinc-950 p-3 text-xs text-zinc-300">
              {JSON.stringify(selectedLog?.metadata, null, 2)}
            </pre>
          </div>
        </div>
      </AppDrawer>
    </div>
  );
}

export default AuditLogsPage;
