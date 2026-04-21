import { Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import AppDrawer from '../../components/common/AppDrawer';
import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import SearchFilters from '../../components/common/SearchFilters';
import usePagination from '../../hooks/usePagination';
import { auditLogsApi } from '../../modules/auditLogs/auditLogs.api';
import { AUDIT_ACTIONS, ENTITY_TYPES } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';

function AuditLogsPage() {
  const { setPage, setLimit, paginationQuery } = usePagination();
  const [filters, setFilters] = useState({ entityType: '', action: '' });
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    async function load() {
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

    load();
  }, [filters, paginationQuery.page, paginationQuery.limit]);

  const columns = useMemo(() => [
    { key: 'actorUser', label: 'Actor', render: (row) => row.actorUser?.fullName || 'System' },
    { key: 'entityType', label: 'Entity Type' },
    { key: 'entityId', label: 'Entity ID' },
    { key: 'action', label: 'Action' },
    { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'metadata',
      label: 'Metadata Preview',
      render: (row) => (
        <Typography color="text.secondary" noWrap sx={{ maxWidth: 260 }} variant="body2">
          {JSON.stringify(row.metadata)}
        </Typography>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => <Button onClick={() => setSelectedLog(row)} size="small">View</Button>,
    },
  ], []);

  if (loading && !logs.length) {
    return <LoadingScreen message="Loading audit logs..." />;
  }

  if (error && !logs.length) {
    return <ErrorState description={error} onAction={() => window.location.reload()} />;
  }

  return (
    <Stack spacing={3}>
      <PageHeader subtitle="Inspect system activity for users, wallets, and token requests." title="Audit Logs" />
      <SearchFilters>
        <TextField
          label="Entity Type"
          onChange={(event) => setFilters((current) => ({ ...current, entityType: event.target.value }))}
          select
          value={filters.entityType}
        >
          <MenuItem value="">All</MenuItem>
          {Object.values(ENTITY_TYPES).map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
        </TextField>
        <TextField
          label="Action"
          onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
          select
          value={filters.action}
        >
          <MenuItem value="">All</MenuItem>
          {Object.values(AUDIT_ACTIONS).map((action) => <MenuItem key={action} value={action}>{action}</MenuItem>)}
        </TextField>
        <Button onClick={() => setFilters({ entityType: '', action: '' })} variant="outlined">Reset Filters</Button>
      </SearchFilters>
      <AppTable
        columns={columns}
        error={error}
        loading={loading}
        onPageChange={setPage}
        onRowsPerPageChange={setLimit}
        onRetry={() => window.location.reload()}
        pagination={pagination}
        rows={logs}
      />

      <AppDrawer onClose={() => setSelectedLog(null)} open={Boolean(selectedLog)} title="Audit Log Details">
        <Typography variant="body2">Actor: {selectedLog?.actorUser?.fullName || 'System'}</Typography>
        <Typography variant="body2">Entity Type: {selectedLog?.entityType}</Typography>
        <Typography variant="body2">Entity ID: {selectedLog?.entityId}</Typography>
        <Typography variant="body2">Action: {selectedLog?.action}</Typography>
        <Typography variant="body2">Created: {formatDateTime(selectedLog?.createdAt)}</Typography>
        <Typography variant="subtitle2">Metadata</Typography>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {JSON.stringify(selectedLog?.metadata, null, 2)}
        </pre>
      </AppDrawer>
    </Stack>
  );
}

export default AuditLogsPage;
