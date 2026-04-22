import { Alert, Button, Link, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import AppDialog from '../../components/common/AppDialog';
import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import TypeChip from '../../components/common/TypeChip';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { formatAmount, truncateMiddle } from '../../utils/format';

function ReadyForExecutionPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const [approved, ready] = await Promise.all([
        tokenRequestsApi.list({ page: 1, limit: 50, status: 'APPROVED' }),
        tokenRequestsApi.list({ page: 1, limit: 50, status: 'READY_FOR_EXECUTION' }),
      ]);
      setRequests([...approved.data.items, ...ready.data.items]);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load execution queue.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
    { key: 'makerUser', label: 'Maker', render: (row) => row.makerUser?.fullName || '-' },
    { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatAmount(row.amount) },
    { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      disableRowClick: true,
      render: (row) => (
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button onClick={() => navigate(`/token-requests/${row.id}`)} size="small" variant="text">Details</Button>
          {row.status === 'APPROVED' ? (
            <Button
              onClick={async () => {
                await tokenRequestsApi.markReady(row.id);
                enqueueSnackbar('Request marked ready', { variant: 'success' });
                load();
              }}
              size="small"
              variant="contained"
            >
              Mark Ready
            </Button>
          ) : (
            <Button onClick={() => setSelectedRequest(row)} size="small" variant="outlined">
              Execute
            </Button>
          )}
        </Stack>
      ),
    },
  ], [enqueueSnackbar, navigate]);

  if (loading) {
    return <LoadingScreen message="Loading execution queue..." />;
  }

  if (error && !requests.length) {
    return <ErrorState description={error} onAction={load} />;
  }

  return (
    <Stack spacing={3}>
      <PageHeader subtitle="Prepare approved requests for execution and capture outcomes." title="Ready for Execution" />
      <AppTable columns={columns} error={error} onRetry={load} onRowClick={(row) => navigate(`/token-requests/${row.id}`)} pagination={null} rows={requests} />

      <AppDialog
        actions={
          <>
            <Button onClick={() => setSelectedRequest(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                try {
                  setSubmitting(true);
                  const response = await tokenRequestsApi.execute(selectedRequest.id);
                  const signature = response?.data?.execution?.txSignature;
                  enqueueSnackbar(
                    signature ? `Execution submitted: ${truncateMiddle(signature, 8, 6)}` : 'Execution completed',
                    { variant: 'success' },
                  );
                  setSelectedRequest(null);
                  load();
                } catch (submitError) {
                  enqueueSnackbar(submitError.message || 'Execution failed', { variant: 'error' });
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
              variant="contained"
            >
              Execute On Chain
            </Button>
          </>
        }
        onClose={() => setSelectedRequest(null)}
        open={Boolean(selectedRequest)}
        title="Execute Request"
      >
        <Stack spacing={2}>
          <Alert severity="info">
            The backend will create the on-chain request, submit the approval transaction, and record the execution result automatically on the local validator.
          </Alert>
          <Typography color="text.secondary" variant="body2">
            This uses the server-managed maker and checker wallets configured in the backend. For transfer and burn, the source wallet must match the configured maker wallet.
          </Typography>
        </Stack>
      </AppDialog>
    </Stack>
  );
}

export default ReadyForExecutionPage;
