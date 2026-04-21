import { Button, Link, Stack, TextField } from '@mui/material';
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
import { rejectionSchema } from '../../modules/tokenRequests/tokenRequests.schemas';
import { formatAmount, truncateMiddle } from '../../utils/format';

function PendingApprovalsPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');
      const response = await tokenRequestsApi.list({ page: 1, limit: 50, status: 'PENDING_APPROVAL' });
      setRequests(response.data.items);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load pending approvals.');
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
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      disableRowClick: true,
      render: (row) => (
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button onClick={() => navigate(`/token-requests/${row.id}`)} size="small" variant="text">Details</Button>
          <Button
            onClick={async () => {
              await tokenRequestsApi.approve(row.id, { comment: 'Approved from queue' });
              enqueueSnackbar('Request approved', { variant: 'success' });
              load();
            }}
            size="small"
            variant="contained"
          >
            Approve
          </Button>
          <Button color="error" onClick={() => setSelectedRequest(row)} size="small" variant="outlined">
            Reject
          </Button>
        </Stack>
      ),
    },
  ], [enqueueSnackbar, navigate]);

  if (loading) {
    return <LoadingScreen message="Loading pending approvals..." />;
  }

  if (error && !requests.length) {
    return <ErrorState description={error} onAction={load} />;
  }

  return (
    <Stack spacing={3}>
      <PageHeader subtitle="Approve or reject pending maker requests." title="Pending Approvals" />
      <AppTable columns={columns} onRowClick={(row) => navigate(`/token-requests/${row.id}`)} pagination={null} rows={requests} />
      

      <AppDialog
        actions={
          <>
            <Button onClick={() => setSelectedRequest(null)}>Cancel</Button>
            <Button
              color="error"
              onClick={async () => {
                const parsed = rejectionSchema.safeParse({
                  rejectionReason,
                  comment: rejectionReason,
                });
                if (!parsed.success) {
                  enqueueSnackbar(parsed.error.issues[0]?.message || 'Rejection reason is required', { variant: 'error' });
                  return;
                }
                await tokenRequestsApi.reject(selectedRequest.id, parsed.data);
                enqueueSnackbar('Request rejected', { variant: 'success' });
                setSelectedRequest(null);
                setRejectionReason('');
                load();
              }}
              variant="contained"
            >
              Confirm Reject
            </Button>
          </>
        }
        onClose={() => setSelectedRequest(null)}
        open={Boolean(selectedRequest)}
        title="Reject Request"
      >
        <TextField
          fullWidth
          label="Rejection Reason"
          multiline
          minRows={3}
          onChange={(event) => setRejectionReason(event.target.value)}
          value={rejectionReason}
        />
      </AppDialog>
    </Stack>
  );
}

export default PendingApprovalsPage;
