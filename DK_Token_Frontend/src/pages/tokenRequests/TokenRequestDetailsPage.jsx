import {
  Alert,
  Button,
  Card,
  CardContent,
  Grid,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import AppDialog from '../../components/common/AppDialog';
import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import RequestTimeline from '../../components/common/RequestTimeline';
import StatusChip from '../../components/common/StatusChip';
import WalletConnectCard from '../../components/wallet/WalletConnectCard';
import useAuth from '../../hooks/useAuth';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { rejectionSchema } from '../../modules/tokenRequests/tokenRequests.schemas';
import { getStatusTimeline } from '../../modules/tokenRequests/tokenRequests.utils';
import { formatDateTime } from '../../utils/date';
import { formatAmount, truncateMiddle } from '../../utils/format';
import {
  canApproveRequest,
  canEditDraftRequest,
  canExecuteRequest,
  canMarkReady,
  canRejectRequest,
  canSubmitDraftRequest,
} from '../../utils/permissions';

function TokenRequestDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogType, setDialogType] = useState(null);
  const [formState, setFormState] = useState({
    rejectionReason: '',
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const response = await tokenRequestsApi.getById(id);
        setRequest(response.data);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load request details.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  const reload = async () => {
    try {
      setError('');
      const response = await tokenRequestsApi.getById(id);
      setRequest(response.data);
    } catch (loadError) {
      setError(loadError.message || 'Unable to refresh request details.');
    }
  };

  const timeline = useMemo(() => getStatusTimeline(request || {}), [request]);
  if (loading) {
    return <LoadingScreen message="Loading request details..." />;
  }

  if (error || !request) {
    return <ErrorState description={error || 'Request not available.'} onAction={reload} />;
  }

  return (
    <Stack spacing={3}>
      <PageHeader subtitle="Review request details, history, and next actions." title={request.id} />

      <Stack direction="row" flexWrap="wrap" gap={1}>
        {canEditDraftRequest(user, request) ? (
          <Button onClick={() => navigate('/token-requests/new', { state: { request } })} variant="outlined">
            Edit Draft
          </Button>
        ) : null}
        {canSubmitDraftRequest(user, request) ? (
          <Button
            onClick={async () => {
              await tokenRequestsApi.submit(request.id);
              enqueueSnackbar('Request submitted', { variant: 'success' });
              reload();
            }}
            variant="contained"
          >
            Submit
          </Button>
        ) : null}
        {canApproveRequest(user, request) ? (
          <Button onClick={() => setDialogType('approve')} variant="contained">
            Approve
          </Button>
        ) : null}
        {canRejectRequest(user, request) ? (
          <Button color="error" onClick={() => setDialogType('reject')} variant="outlined">
            Reject
          </Button>
        ) : null}
        {canMarkReady(user, request) ? (
          <Button
            onClick={async () => {
              await tokenRequestsApi.markReady(request.id);
              enqueueSnackbar('Request marked ready', { variant: 'success' });
              reload();
            }}
            variant="contained"
          >
            Mark Ready
          </Button>
        ) : null}
        {canExecuteRequest(user, request) ? (
          <Button
            onClick={async () => {
              try {
                const response = await tokenRequestsApi.execute(request.id);
                const signature = response?.data?.execution?.txSignature;
                enqueueSnackbar(
                  signature ? `Execution submitted: ${truncateMiddle(signature, 8, 6)}` : 'Request executed',
                  { variant: 'success' },
                );
                reload();
              } catch (executionError) {
                enqueueSnackbar(executionError.message || 'Execution failed', { variant: 'error' });
              }
            }}
            variant="contained"
          >
            Execute On Chain
          </Button>
        ) : null}
      </Stack>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1}>
                  <StatusChip kind="type" value={request.requestType} />
                  <StatusChip value={request.status} />
                </Stack>
                <Typography variant="h6">Request Metadata</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography color="text.secondary" variant="body2">Token Mint Address</Typography>
                    <Typography>{truncateMiddle(request.tokenMintAddress, 10, 8)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography color="text.secondary" variant="body2">Amount</Typography>
                    <Typography>{formatAmount(request.amount)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography color="text.secondary" variant="body2">Source Wallet</Typography>
                    <Typography>{request.sourceWallet?.label || '-'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography color="text.secondary" variant="body2">Destination Wallet</Typography>
                    <Typography>{request.destinationWallet?.label || '-'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography color="text.secondary" variant="body2">Maker</Typography>
                    <Typography>{request.makerUser?.fullName || '-'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography color="text.secondary" variant="body2">Checker</Typography>
                    <Typography>{request.checkerUser?.fullName || '-'}</Typography>
                  </Grid>
                </Grid>
                <Typography color="text.secondary" variant="body2">Remarks</Typography>
                <Typography>{request.remarks || 'No remarks provided'}</Typography>
                {request.rejectionReason ? <Alert severity="error">Rejection reason: {request.rejectionReason}</Alert> : null}
                {request.executionError ? <Alert severity="warning">Execution error: {request.executionError}</Alert> : null}
                {request.explorerUrl ? (
                  <Link href={request.explorerUrl} rel="noreferrer" target="_blank">
                    View explorer transaction
                  </Link>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography sx={{ mb: 2 }} variant="h6">Approval History</Typography>
              <AppTable
                columns={[
                  { key: 'action', label: 'Action' },
                  { key: 'checkerUser', label: 'Checker', render: (row) => row.checkerUser?.fullName || '-' },
                  { key: 'comment', label: 'Comment' },
                  { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
                ]}
                pagination={null}
                rows={request.approvals || []}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography sx={{ mb: 2 }} variant="h6">Request Timeline</Typography>
                <RequestTimeline items={timeline} request={request} />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography sx={{ mb: 2 }} variant="h6">Timestamps</Typography>
                <Stack spacing={1}>
                  <Typography>Created: {formatDateTime(request.createdAt)}</Typography>
                  <Typography>Approved: {formatDateTime(request.approvedAt)}</Typography>
                  <Typography>Rejected: {formatDateTime(request.rejectedAt)}</Typography>
                  <Typography>Executed: {formatDateTime(request.executedAt)}</Typography>
                </Stack>
              </CardContent>
            </Card>

            <WalletConnectCard />
          </Stack>
        </Grid>
      </Grid>

      <AppDialog
        actions={
          <>
            <Button onClick={() => setDialogType(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                await tokenRequestsApi.approve(request.id, { comment: 'Approved from details page' });
                enqueueSnackbar('Request approved', { variant: 'success' });
                setDialogType(null);
                reload();
              }}
              variant="contained"
            >
              Confirm Approve
            </Button>
          </>
        }
        onClose={() => setDialogType(null)}
        open={dialogType === 'approve'}
        title="Approve Request"
      >
        <Typography color="text.secondary">
          This will approve the request and assign you as checker.
        </Typography>
      </AppDialog>

      <AppDialog
        actions={
          <>
            <Button onClick={() => setDialogType(null)}>Cancel</Button>
            <Button
              color="error"
              onClick={async () => {
                const parsed = rejectionSchema.safeParse({
                  rejectionReason: formState.rejectionReason,
                  comment: formState.rejectionReason,
                });
                if (!parsed.success) {
                  enqueueSnackbar(parsed.error.issues[0]?.message || 'Rejection reason is required', { variant: 'error' });
                  return;
                }
                await tokenRequestsApi.reject(request.id, parsed.data);
                enqueueSnackbar('Request rejected', { variant: 'success' });
                setDialogType(null);
                setFormState((current) => ({ ...current, rejectionReason: '' }));
                reload();
              }}
              variant="contained"
            >
              Confirm Reject
            </Button>
          </>
        }
        onClose={() => setDialogType(null)}
        open={dialogType === 'reject'}
        title="Reject Request"
      >
        <TextField
          fullWidth
          label="Rejection Reason"
          multiline
          minRows={3}
          onChange={(event) => setFormState((current) => ({ ...current, rejectionReason: event.target.value }))}
          value={formState.rejectionReason}
        />
      </AppDialog>

    </Stack>
  );
}

export default TokenRequestDetailsPage;
