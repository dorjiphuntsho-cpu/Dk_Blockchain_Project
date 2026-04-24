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
import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

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
  buildCheckerRejectionTransaction,
  buildExplorerTransactionUrl,
  buildMakerInitiationTransaction,
  signAndSendMakerTransaction,
  signAndSendWalletTransaction,
} from '../../modules/solana/walletExecution';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import {
  clearPendingInitiationRecovery,
  getPendingInitiationRecovery,
  savePendingInitiationRecovery,
} from '../../modules/tokenRequests/tokenRequestRecovery';
import { rejectionSchema } from '../../modules/tokenRequests/tokenRequests.schemas';
import { getNextActorMessage, getStatusTimeline } from '../../modules/tokenRequests/tokenRequests.utils';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/error';
import { formatAmount, truncateMiddle } from '../../utils/format';
import {
  canApproveWalletExecution,
  canEditDraftRequest,
  canInitiateWalletExecution,
  canExecuteRequest,
  canRejectRequest,
  canSubmitDraftRequest,
} from '../../utils/permissions';
import { EXECUTION_MODES, ON_CHAIN_PENDING_STATUSES } from '../../utils/constants';
import { REQUEST_STATUSES } from '../../utils/constants';

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
  const [recoveringInitiation, setRecoveringInitiation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
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

  useEffect(() => {
    async function recoverInitiation() {
      if (!request?.id || request.status !== REQUEST_STATUSES.DRAFT || recoveringInitiation) {
        return;
      }

      const recovery = getPendingInitiationRecovery(request.id);
      if (!recovery?.payload) {
        return;
      }

      try {
        setRecoveringInitiation(true);
        await tokenRequestsApi.recordInitiation(request.id, recovery.payload);
        clearPendingInitiationRecovery(request.id);
        enqueueSnackbar('Recovered the previous wallet submission and finalized the request record.', {
          variant: 'success',
        });
        await reload();
      } catch (recoveryError) {
        const message = getErrorMessage(recoveryError, 'Unable to recover the previous wallet submission');
        const shouldClearRecovery = /only draft requests|already processed on chain|not found/i.test(message);

        if (shouldClearRecovery) {
          clearPendingInitiationRecovery(request.id);
          await reload();
        }
      } finally {
        setRecoveringInitiation(false);
      }
    }

    recoverInitiation();
  }, [enqueueSnackbar, recoveringInitiation, request]);

  const timeline = useMemo(() => getStatusTimeline(request || {}), [request]);
  const expectedMakerWalletAddress = executionPayload?.walletInitiation?.expectedMakerWalletAddress || null;
  const onChainCheckers = executionPayload?.onChainCheckers || [];
  const connectedWalletRegisteredOnChain = !onChainCheckers.length || (
    walletConnected && connectedWalletAddress && onChainCheckers.includes(connectedWalletAddress)
  );
  const walletMismatch = Boolean(
    walletConnected && expectedMakerWalletAddress && connectedWalletAddress && expectedMakerWalletAddress !== connectedWalletAddress,
  );
  const canInitiateWithWallet = canInitiateWalletExecution(user, request, executionPayload);
  const canApproveWithWallet = canApproveWalletExecution(user, request);

  const isAlreadyProcessedMessage = (value) => {
    const normalized = String(value || '').toLowerCase();
    return normalized.includes('alreadyprocessed')
      || normalized.includes('request already processed')
      || normalized.includes('already been processed')
      || normalized.includes('error code: 6000')
      || normalized.includes('custom program error: 0x1770');
  };

  const collectApprovalErrorDetails = async (error) => {
    const details = [
      error?.message,
      error?.cause?.message,
      ...(Array.isArray(error?.logs) ? error.logs : []),
      ...(Array.isArray(error?.transactionLogs) ? error.transactionLogs : []),
    ].filter(Boolean);

    if (typeof error?.getLogs === 'function') {
      try {
        const rpcLogs = await error.getLogs();
        if (Array.isArray(rpcLogs) && rpcLogs.length) {
          details.push(...rpcLogs);
        }
      } catch {
        // Ignore secondary log lookup failures and keep the original error chain.
      }
    }

    return details;
  };

  const ensureDestinationTokenAccount = async (transaction, checkerPayload, connection) => {
    const destinationWalletAddress = request.destinationWallet?.walletAddress
      || checkerPayload.destinationWalletAddress
      || checkerPayload.walletInitiation?.destinationWalletAddress
      || null;

    if (!destinationWalletAddress) {
      return;
    }

    const mintAddress = checkerPayload.tokenMintAddress || request.tokenMintAddress;
    if (!mintAddress) {
      return;
    }

    const mintPublicKey = new PublicKey(mintAddress);
    const destinationWalletPublicKey = new PublicKey(destinationWalletAddress);
    const expectedDestinationAta = await getAssociatedTokenAddress(mintPublicKey, destinationWalletPublicKey);
    const configuredDestinationAddress = request.destinationTokenAccountAddress
      || checkerPayload.destinationTokenAccountAddress
      || checkerPayload.destinationTokenAccount
      || null;

    if (configuredDestinationAddress && configuredDestinationAddress !== expectedDestinationAta.toBase58()) {
      return;
    }

    try {
      await getAccount(connection, expectedDestinationAta, 'confirmed');
    } catch {
      transaction.instructions.unshift(
        createAssociatedTokenAccountInstruction(
          checkerPayload.expectedCheckerWalletAddress || checkerPayload.checkerWalletAddress || connectedWalletAddress,
          expectedDestinationAta,
          destinationWalletPublicKey,
          mintPublicKey,
        ),
      );
    }
  };
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
              try {
                await tokenRequestsApi.submit(request.id);
                enqueueSnackbar('Request submitted', { variant: 'success' });
                reload();
              } catch (submitError) {
                enqueueSnackbar(getErrorMessage(submitError, 'Unable to submit request'), { variant: 'error' });
              }
            }}
            variant="contained"
          >
            Submit
          </Button>
        ) : null}
        {canRejectRequest(user, request) ? (
          <Button color="error" onClick={() => setRejectDialogOpen(true)} variant="outlined">
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

                const initiationPayload = {
                  makerWalletAddress: connectedWalletAddress,
                  onChainRequestAddress: builtTransaction.requestAddress,
                  initiationTxSignature: initiationSignature,
                  initiationExplorerUrl: buildExplorerTransactionUrl(initiationSignature, executionPayload.rpcUrl),
                };

                if (builtTransaction.sourceTokenAccountAddress) {
                  initiationPayload.sourceTokenAccountAddress = builtTransaction.sourceTokenAccountAddress;
                }

                if (builtTransaction.destinationTokenAccountAddress) {
                  initiationPayload.destinationTokenAccountAddress = builtTransaction.destinationTokenAccountAddress;
                }

                savePendingInitiationRecovery(request.id, initiationPayload);
                await tokenRequestsApi.recordInitiation(request.id, initiationPayload);
                clearPendingInitiationRecovery(request.id);

                enqueueSnackbar(`Wallet initiation submitted: ${truncateMiddle(initiationSignature, 8, 6)}`, {
                  variant: 'success',
                });
                await reload();
              } catch (walletError) {
                enqueueSnackbar(
                  getErrorMessage(walletError, 'Wallet initiation failed. If the wallet already signed, the page will retry recording it automatically.'),
                  { variant: 'error' },
                );
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
              disabled={isSubmitting || !walletConnected || executionPayloadLoading}
              onClick={async () => {
                if (isSubmitting) {
                  return;
                }

                let checkerPayload = null;
                let approvalConnection = null;

                try {
                  if (!walletConnected || !connectedWalletAddress) {
                    throw new Error('Connect a registered checker wallet before approving this request on chain.');
                  }

                  if (!walletProvider) {
                    throw new Error('Wallet provider is not available.');
                  }

                  setIsSubmitting(true);

                  const preparedResponse = await tokenRequestsApi.prepareCheckerApproval(
                    request.id,
                    connectedWalletAddress,
                  );
                  checkerPayload = preparedResponse.data;
                  const checkerOnChainCheckers = Array.isArray(checkerPayload.onChainCheckers) ? checkerPayload.onChainCheckers : [];

                  if (checkerOnChainCheckers.length && !checkerOnChainCheckers.includes(connectedWalletAddress)) {
                    throw new Error(
                      `Connected wallet ${connectedWalletAddress} is not registered on chain as a checker. ` +
                      `Registered checkers: ${checkerOnChainCheckers.join(', ')}`,
                    );
                  }

                  if (!checkerPayload.approvalInstruction) {
                    throw new Error('Checker approval instruction was not returned by the backend. Restart the backend and try again.');
                  }

                  const builtTransaction = await buildCheckerApprovalTransaction({
                    executionPayload: checkerPayload,
                    checkerWalletAddress: connectedWalletAddress,
                    sourceWalletAddress: request.sourceWallet?.walletAddress || null,
                    destinationWalletAddress: request.destinationWallet?.walletAddress || null,
                    sourceTokenAccountAddress: request.sourceTokenAccountAddress || null,
                    destinationTokenAccountAddress: request.destinationTokenAccountAddress || null,
                  });
                  approvalConnection = builtTransaction.connection;

                  await ensureDestinationTokenAccount(
                    builtTransaction.transaction,
                    checkerPayload,
                    builtTransaction.connection,
                  );

                  const approvalSignature = await signAndSendWalletTransaction({
                    connection: builtTransaction.connection,
                    provider: walletProvider,
                    transaction: builtTransaction.transaction,
                  });

                  await tokenRequestsApi.approve(request.id, {
                    comment: 'Approved on chain with wallet',
                    txSignature: approvalSignature,
                    explorerUrl: buildExplorerTransactionUrl(approvalSignature, checkerPayload.rpcUrl),
                  });

                  enqueueSnackbar(`Checker approval submitted: ${truncateMiddle(approvalSignature, 8, 6)}`, {
                    variant: 'success',
                  });
                } catch (walletError) {
                  const approvalErrorDetails = await collectApprovalErrorDetails(walletError);
                  const alreadyProcessed = approvalErrorDetails.some(isAlreadyProcessedMessage);

                  if (alreadyProcessed) {
                    enqueueSnackbar('This request has already been processed.', { variant: 'warning' });
                  } else {
                    enqueueSnackbar(getErrorMessage(walletError, 'Checker wallet approval failed'), { variant: 'error' });
                  }
              } finally {
                  setIsSubmitting(false);
                  if (approvalConnection || checkerPayload) {
                    await reload();
                  }
              }
              }}
              variant="contained"
            >
              {isSubmitting ? 'Approving...' : 'Approve On Chain With Wallet'}
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
                enqueueSnackbar(getErrorMessage(executionError, 'Execution failed'), { variant: 'error' });
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
                {recoveringInitiation ? (
                  <Alert severity="info">Finalizing a previously signed maker wallet submission...</Alert>
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
                {walletConnected && onChainCheckers.length && !connectedWalletRegisteredOnChain ? (
                  <Alert severity="warning">
                    The connected Phantom wallet is not registered on chain as a checker for this configuration. Switch to a registered checker wallet or update the Solana config.
                  </Alert>
                ) : null}
                {onChainCheckers.length ? (
                  <Alert severity={connectedWalletRegisteredOnChain ? 'success' : 'warning'}>
                    On-chain checkers: {onChainCheckers.join(', ')}
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
            <Button
              disabled={rejectSubmitting}
              onClick={() => {
                setRejectDialogOpen(false);
                setFormState((current) => ({ ...current, rejectionReason: '' }));
              }}
            >
              Cancel
            </Button>
            <Button
              color="error"
              disabled={rejectSubmitting}
              onClick={async () => {
                try {
                  setRejectSubmitting(true);
                  if (!walletConnected || !connectedWalletAddress) {
                    throw new Error('Connect a checker wallet before rejecting this request.');
                  }

                  if (!walletProvider) {
                    throw new Error('Wallet provider is not available.');
                  }

                  const parsed = rejectionSchema.safeParse({
                    rejectionReason: formState.rejectionReason,
                    comment: formState.rejectionReason,
                  });
                  if (!parsed.success) {
                    throw new Error(parsed.error.issues[0]?.message || 'Rejection reason is required');
                  }

                  const preparedResponse = await tokenRequestsApi.prepareCheckerRejection(request.id);
                  const checkerPayload = preparedResponse.data;
                  const builtTransaction = buildCheckerRejectionTransaction({
                    executionPayload: checkerPayload,
                    checkerWalletAddress: connectedWalletAddress,
                  });

                  const txSignature = await signAndSendWalletTransaction({
                    connection: builtTransaction.connection,
                    provider: walletProvider,
                    transaction: builtTransaction.transaction,
                  });

                  await tokenRequestsApi.reject(request.id, {
                    ...parsed.data,
                    txSignature,
                    explorerUrl: buildExplorerTransactionUrl(txSignature, checkerPayload.rpcUrl),
                  });
                  enqueueSnackbar('Request rejected with wallet signature', { variant: 'success' });
                  setFormState((current) => ({ ...current, rejectionReason: '' }));
                  setRejectDialogOpen(false);
                  reload();
                } catch (rejectionError) {
                  enqueueSnackbar(getErrorMessage(rejectionError, 'Unable to reject request'), { variant: 'error' });
                } finally {
                  setRejectSubmitting(false);
                }
              }}
              variant="contained"
            >
              {rejectSubmitting ? 'Processing...' : 'Confirm Reject'}
            </Button>
          </>
        }
        onClose={() => {
          setRejectDialogOpen(false);
          setFormState((current) => ({ ...current, rejectionReason: '' }));
        }}
        open={rejectDialogOpen}
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
