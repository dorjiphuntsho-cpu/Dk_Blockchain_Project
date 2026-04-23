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
import useSolanaWallet from '../../hooks/useSolanaWallet';
import {
  buildCheckerApprovalTransaction,
  buildExplorerTransactionUrl,
  buildMakerInitiationTransaction,
  signAndSendMakerTransaction,
  signAndSendWalletTransaction,
} from '../../modules/solana/walletExecution';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { rejectionSchema } from '../../modules/tokenRequests/tokenRequests.schemas';
import { getNextActorMessage, getStatusTimeline } from '../../modules/tokenRequests/tokenRequests.utils';
import { formatDateTime } from '../../utils/date';
import { formatAmount, truncateMiddle } from '../../utils/format';
import {
  canApproveWalletExecution,
  canApproveRequest,
  canEditDraftRequest,
  canInitiateWalletExecution,
  canExecuteRequest,
  canRejectRequest,
  canSubmitDraftRequest,
} from '../../utils/permissions';
import { EXECUTION_MODES, ON_CHAIN_PENDING_STATUSES, REQUEST_STATUSES } from '../../utils/constants';

function TokenRequestDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const {
    address: connectedWalletAddress,
    connected: walletConnected,
    provider: walletProvider,
  } = useSolanaWallet();
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [executionPayload, setExecutionPayload] = useState(null);
  const [executionPayloadError, setExecutionPayloadError] = useState('');
  const [executionPayloadLoading, setExecutionPayloadLoading] = useState(false);
  const [walletInitiating, setWalletInitiating] = useState(false);
  const [walletApproving, setWalletApproving] = useState(false);
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

  useEffect(() => {
    if (!request || !ON_CHAIN_PENDING_STATUSES.includes(request.status)) {
      setExecutionPayload(null);
      setExecutionPayloadError('');
      setExecutionPayloadLoading(false);
      return;
    }

    let cancelled = false;

    async function loadExecutionPayload() {
      try {
        setExecutionPayloadLoading(true);
        setExecutionPayloadError('');
        const response = await tokenRequestsApi.getExecutionPayload(request.id);
        if (!cancelled) {
          setExecutionPayload(response.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setExecutionPayload(null);
          setExecutionPayloadError(loadError.message || 'Unable to load execution payload.');
        }
      } finally {
        if (!cancelled) {
          setExecutionPayloadLoading(false);
        }
      }
    }

    loadExecutionPayload();

    return () => {
      cancelled = true;
    };
  }, [request]);

  const timeline = useMemo(() => getStatusTimeline(request || {}), [request]);
  const expectedMakerWalletAddress = executionPayload?.walletInitiation?.expectedMakerWalletAddress || null;
  const walletMismatch = Boolean(
    walletConnected && expectedMakerWalletAddress && connectedWalletAddress && expectedMakerWalletAddress !== connectedWalletAddress,
  );
  const canInitiateWithWallet = canInitiateWalletExecution(user, request, executionPayload);
  const canApproveWithWallet = canApproveWalletExecution(user, request, executionPayload);
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
        {canInitiateWithWallet ? (
          <Button
            disabled={walletInitiating || !walletConnected || walletMismatch || executionPayloadLoading}
            onClick={async () => {
              try {
                if (!walletConnected || !connectedWalletAddress) {
                  throw new Error('Connect the maker wallet before initiating this request.');
                }

                if (!walletProvider) {
                  throw new Error('Wallet provider is not available.');
                }

                if (!executionPayload) {
                  throw new Error('Execution payload is not ready yet. Try again in a moment.');
                }

                setWalletInitiating(true);

                const builtTransaction = await buildMakerInitiationTransaction({
                  executionPayload,
                  makerWalletAddress: connectedWalletAddress,
                });

                const initiationSignature = await signAndSendMakerTransaction({
                  connection: builtTransaction.connection,
                  provider: walletProvider,
                  requestKeypair: builtTransaction.requestKeypair,
                  transaction: builtTransaction.transaction,
                });

                await tokenRequestsApi.recordInitiation(request.id, {
                  makerWalletAddress: connectedWalletAddress,
                  onChainRequestAddress: builtTransaction.requestAddress,
                  initiationTxSignature: initiationSignature,
                  initiationExplorerUrl: buildExplorerTransactionUrl(initiationSignature, executionPayload.rpcUrl),
                  sourceTokenAccountAddress: builtTransaction.sourceTokenAccountAddress,
                  destinationTokenAccountAddress: builtTransaction.destinationTokenAccountAddress,
                });

                enqueueSnackbar(`Wallet initiation submitted: ${truncateMiddle(initiationSignature, 8, 6)}`, {
                  variant: 'success',
                });
                await reload();
              } catch (walletError) {
                enqueueSnackbar(walletError.message || 'Wallet initiation failed', { variant: 'error' });
              } finally {
                setWalletInitiating(false);
              }
            }}
            variant="contained"
          >
            {walletInitiating ? 'Initiating...' : 'Initiate With Wallet'}
          </Button>
        ) : null}
        {canApproveWithWallet ? (
          <Button
            disabled={walletApproving || !walletConnected || executionPayloadLoading}
            onClick={async () => {
              try {
                if (!walletConnected || !connectedWalletAddress) {
                  throw new Error('Connect a registered checker wallet before approving this request on chain.');
                }

                if (!walletProvider) {
                  throw new Error('Wallet provider is not available.');
                }

                if (!executionPayload) {
                  throw new Error('Execution payload is not ready yet. Try again in a moment.');
                }

                setWalletApproving(true);

                const preparedResponse = await tokenRequestsApi.prepareCheckerApproval(request.id);
                const checkerPayload = preparedResponse.data;
                const builtTransaction = buildCheckerApprovalTransaction({
                  executionPayload: checkerPayload,
                  checkerWalletAddress: connectedWalletAddress,
                });

                const approvalSignature = await signAndSendWalletTransaction({
                  connection: builtTransaction.connection,
                  provider: walletProvider,
                  transaction: builtTransaction.transaction,
                });

                await tokenRequestsApi.recordExecution(request.id, {
                  status: REQUEST_STATUSES.EXECUTED,
                  txSignature: approvalSignature,
                  explorerUrl: buildExplorerTransactionUrl(approvalSignature, executionPayload.rpcUrl),
                });

                enqueueSnackbar(`Checker approval submitted: ${truncateMiddle(approvalSignature, 8, 6)}`, {
                  variant: 'success',
                });
                await reload();
              } catch (walletError) {
                enqueueSnackbar(walletError.message || 'Checker wallet approval failed', { variant: 'error' });
              } finally {
                setWalletApproving(false);
              }
            }}
            variant="contained"
          >
            {walletApproving ? 'Approving...' : 'Approve On Chain With Wallet'}
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
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography color="text.secondary" variant="body2">Execution Mode</Typography>
                    <Typography>{request.executionMode || EXECUTION_MODES.SERVER_MANAGED}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography color="text.secondary" variant="body2">Maker Wallet Address</Typography>
                    <Typography sx={{ wordBreak: 'break-all' }}>{request.makerWalletAddress || request.sourceWallet?.walletAddress || '-'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography color="text.secondary" variant="body2">On-Chain Request</Typography>
                    <Typography sx={{ wordBreak: 'break-all' }}>{request.onChainRequestAddress || '-'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography color="text.secondary" variant="body2">Maker Initiated</Typography>
                    <Typography>{formatDateTime(request.makerInitiatedAt)}</Typography>
                  </Grid>
                </Grid>
                <Typography color="text.secondary" variant="body2">Remarks</Typography>
                <Typography>{request.remarks || 'No remarks provided'}</Typography>
                {request.rejectionReason ? <Alert severity="error">Rejection reason: {request.rejectionReason}</Alert> : null}
                {request.executionError ? <Alert severity="warning">Execution error: {request.executionError}</Alert> : null}
                {executionPayloadLoading ? (
                  <Alert severity="info">Refreshing execution payload and wallet requirements...</Alert>
                ) : null}
                {executionPayloadError ? (
                  <Alert severity="warning">{executionPayloadError}</Alert>
                ) : null}
                <Alert severity="info">
                  {getNextActorMessage(request, executionPayload)}
                </Alert>
                {executionPayload?.walletInitiation?.supported ? (
                  <Alert severity={walletMismatch ? 'warning' : executionPayload.walletInitiation.recorded ? 'success' : 'info'}>
                    {executionPayload.walletInitiation.recorded
                      ? 'This request already has maker-side wallet initiation recorded.'
                      : walletMismatch
                        ? `Connected wallet ${connectedWalletAddress} does not match the expected maker wallet ${expectedMakerWalletAddress}.`
                        : expectedMakerWalletAddress
                          ? `This request is ready for maker-side browser signing by ${expectedMakerWalletAddress}.`
                          : 'This request type supports maker-side browser initiation.'}
                  </Alert>
                ) : null}
                {canApproveWithWallet ? (
                  <Alert severity="info">
                    This request has maker initiation recorded. A connected Phantom wallet that is registered on chain as a checker can approve it directly.
                  </Alert>
                ) : null}
                {request.initiationExplorerUrl ? (
                  <Link href={request.initiationExplorerUrl} rel="noreferrer" target="_blank">
                    View initiation transaction
                  </Link>
                ) : null}
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

            <WalletConnectCard executionPayload={executionPayload} requestStatus={request.status} />
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
