import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/16/solid';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

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
  buildMakerCancellationTransaction,
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
import { EXECUTION_MODES, ON_CHAIN_PENDING_STATUSES, REQUEST_STATUSES } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/error';
import { formatAmount, truncateMiddle } from '../../utils/format';
import {
  canApproveWalletExecution,
  canCancelPendingRequest,
  canEditDraftRequest,
  canExecuteRequest,
  canInitiateWalletExecution,
  canRejectRequest,
  canSubmitDraftRequest,
} from '../../utils/permissions';

function InfoAlert({ tone = 'info', children }) {
  const tones = {
    info: 'border-sky-500/20 bg-sky-500/10 text-sky-200',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
    error: 'border-red-500/20 bg-red-500/10 text-red-200',
  };

  return (
    <div className={`min-w-0 break-all rounded-xl border px-4 py-3 text-sm ${tones[tone] || tones.info}`}>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 min-w-0 break-all text-sm text-zinc-100">{children || '-'}</dd>
    </div>
  );
}

function ActionButton({ children, tone = 'secondary', ...props }) {
  const styles = {
    primary: 'bg-white text-zinc-950 hover:bg-zinc-200',
    secondary: 'bg-white/5 text-white ring-1 ring-inset ring-white/10 hover:bg-white/10',
    danger: 'bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20 hover:bg-red-500/20',
  };

  return (
    <button
      type="button"
      className={`w-full rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${styles[tone]}`}
      {...props}
    >
      {children}
    </button>
  );
}

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
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [formState, setFormState] = useState({ rejectionReason: '' });

  const reload = useCallback(async () => {
    try {
      setError('');
      const response = await tokenRequestsApi.getById(id);
      setRequest(response.data);
    } catch (loadError) {
      setError(loadError.message || 'Unable to refresh request details.');
    }
  }, [id]);

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

    void load();
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function loadExecutionPayload() {
      if (!request || !ON_CHAIN_PENDING_STATUSES.includes(request.status)) {
        if (!cancelled) {
          setExecutionPayload(null);
          setExecutionPayloadError('');
          setExecutionPayloadLoading(false);
        }
        return;
      }

      try {
        setExecutionPayloadLoading(true);
        setExecutionPayloadError('');
        const response = await tokenRequestsApi.getExecutionPayload(request.id);
        if (!cancelled) setExecutionPayload(response.data);
      } catch (loadError) {
        if (!cancelled) {
          setExecutionPayload(null);
          setExecutionPayloadError(loadError.message || 'Unable to load execution payload.');
        }
      } finally {
        if (!cancelled) setExecutionPayloadLoading(false);
      }
    }

    void loadExecutionPayload();

    return () => {
      cancelled = true;
    };
  }, [request]);

  useEffect(() => {
    async function recoverInitiation() {
      if (!request?.id || request.status !== REQUEST_STATUSES.DRAFT || recoveringInitiation) return;

      const recovery = getPendingInitiationRecovery(request.id);
      if (!recovery?.payload) return;

      try {
        setRecoveringInitiation(true);
        await tokenRequestsApi.recordInitiation(request.id, recovery.payload);
        clearPendingInitiationRecovery(request.id);
        enqueueSnackbar('Recovered previous wallet submission.', { variant: 'success' });
        await reload();
      } catch (recoveryError) {
        const message = getErrorMessage(recoveryError, 'Unable to recover previous wallet submission');
        if (/only draft requests|already processed on chain|not found/i.test(message)) {
          clearPendingInitiationRecovery(request.id);
          await reload();
        }
      } finally {
        setRecoveringInitiation(false);
      }
    }

    void recoverInitiation();
  }, [enqueueSnackbar, recoveringInitiation, reload, request]);

  const timeline = useMemo(() => getStatusTimeline(request || {}), [request]);

  const expectedMakerWalletAddress = executionPayload?.walletInitiation?.expectedMakerWalletAddress || null;
  const onChainCheckers = executionPayload?.onChainCheckers || [];
  const connectedWalletRegisteredOnChain =
    !onChainCheckers.length ||
    (walletConnected && connectedWalletAddress && onChainCheckers.includes(connectedWalletAddress));

  const walletMismatch = Boolean(
    walletConnected &&
      expectedMakerWalletAddress &&
      connectedWalletAddress &&
      expectedMakerWalletAddress !== connectedWalletAddress,
  );

  const canInitiateWithWallet = canInitiateWalletExecution(user, request, executionPayload);
  const canApproveWithWallet = canApproveWalletExecution(user, request);

  const isAlreadyProcessedMessage = (value) => {
    const normalized = String(value || '').toLowerCase();
    return (
      normalized.includes('alreadyprocessed') ||
      normalized.includes('request already processed') ||
      normalized.includes('already cancelled on chain') ||
      normalized.includes('already been processed') ||
      normalized.includes('error code: 6000') ||
      normalized.includes('custom program error: 0x1770')
    );
  };

  const collectApprovalErrorDetails = async (err) => {
    const details = [
      err?.message,
      err?.cause?.message,
      ...(Array.isArray(err?.logs) ? err.logs : []),
      ...(Array.isArray(err?.transactionLogs) ? err.transactionLogs : []),
    ].filter(Boolean);

    if (typeof err?.getLogs === 'function') {
      try {
        const rpcLogs = await err.getLogs();
        if (Array.isArray(rpcLogs)) details.push(...rpcLogs);
      } catch {
        // ignore
      }
    }

    return details;
  };

  const ensureDestinationTokenAccount = async (transaction, checkerPayload, connection) => {
    const destinationWalletAddress =
      request.destinationWallet?.walletAddress ||
      checkerPayload.destinationWalletAddress ||
      checkerPayload.walletInitiation?.destinationWalletAddress ||
      null;

    if (!destinationWalletAddress) return;

    const mintAddress = checkerPayload.tokenMintAddress || request.tokenMintAddress;
    if (!mintAddress) return;

    const mintPublicKey = new PublicKey(mintAddress);
    const destinationWalletPublicKey = new PublicKey(destinationWalletAddress);
    const expectedDestinationAta = await getAssociatedTokenAddress(
      mintPublicKey,
      destinationWalletPublicKey,
    );

    const configuredDestinationAddress =
      request.destinationTokenAccountAddress ||
      checkerPayload.destinationTokenAccountAddress ||
      checkerPayload.destinationTokenAccount ||
      null;

    if (configuredDestinationAddress && configuredDestinationAddress !== expectedDestinationAta.toBase58()) return;

    try {
      await getAccount(connection, expectedDestinationAta, 'confirmed');
    } catch {
      transaction.instructions.unshift(
        createAssociatedTokenAccountInstruction(
          checkerPayload.expectedCheckerWalletAddress ||
            checkerPayload.checkerWalletAddress ||
            connectedWalletAddress,
          expectedDestinationAta,
          destinationWalletPublicKey,
          mintPublicKey,
        ),
      );
    }
  };

  if (loading) return <LoadingScreen message="Loading request details..." />;
  if (error || !request) return <ErrorState description={error || 'Request not available.'} onAction={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Review request details, history, and next actions." title={request.id} />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canEditDraftRequest(user, request) && (
          <ActionButton onClick={() => navigate('/token-requests/new', { state: { request } })}>
            Edit draft
          </ActionButton>
        )}

        {canSubmitDraftRequest(user, request) && (
          <ActionButton
            tone="primary"
            onClick={async () => {
              try {
                await tokenRequestsApi.submit(request.id);
                enqueueSnackbar('Request submitted', { variant: 'success' });
                reload();
              } catch (submitError) {
                enqueueSnackbar(getErrorMessage(submitError, 'Unable to submit request'), { variant: 'error' });
              }
            }}
          >
            Submit
          </ActionButton>
        )}

        {canCancelPendingRequest(user, request) && (
          <ActionButton
            tone="danger"
            disabled={cancelSubmitting}
            onClick={async () => {
              try {
                setCancelSubmitting(true);
                if (request.onChainRequestAddress) {
                  if (!walletConnected || !connectedWalletAddress) {
                    throw new Error('Connect the maker wallet before cancelling this on-chain request.');
                  }
                  if (!walletProvider) throw new Error('Wallet provider is not available.');

                  const preparedResponse = await tokenRequestsApi.prepareMakerCancellation(
                    request.id,
                    connectedWalletAddress,
                  );
                  const cancellationPayload = preparedResponse.data;
                  const txSignature = cancellationPayload.cancelInstruction
                    ? await (async () => {
                      const builtTransaction = buildMakerCancellationTransaction({
                        executionPayload: cancellationPayload,
                        makerWalletAddress: connectedWalletAddress,
                      });

                      return signAndSendWalletTransaction({
                        connection: builtTransaction.connection,
                        provider: walletProvider,
                        transaction: builtTransaction.transaction,
                      });
                    })()
                    : `mock-cancel-${Date.now()}`;

                  await tokenRequestsApi.recordCancellation(request.id, {
                    makerWalletAddress: connectedWalletAddress,
                    txSignature,
                    explorerUrl: buildExplorerTransactionUrl(txSignature, cancellationPayload.rpcUrl),
                  });
                } else {
                  await tokenRequestsApi.cancel(request.id);
                }

                enqueueSnackbar('Request cancelled', { variant: 'success' });
                await reload();
              } catch (cancelError) {
                const message = getErrorMessage(cancelError, 'Unable to cancel request');
                if (isAlreadyProcessedMessage(message) || /current status is cancelled/i.test(message)) {
                  enqueueSnackbar('This request is already cancelled on chain.', { variant: 'warning' });
                  await reload();
                } else {
                  enqueueSnackbar(message, { variant: 'error' });
                }
              } finally {
                setCancelSubmitting(false);
              }
            }}
          >
            {cancelSubmitting
              ? 'Cancelling...'
              : request.onChainRequestAddress
                ? 'Cancel Request'
                : 'Cancel request'}
          </ActionButton>
        )}

        {canRejectRequest(user, request) && (
          <ActionButton tone="danger" onClick={() => setRejectDialogOpen(true)}>
            Reject
          </ActionButton>
        )}

        {canInitiateWithWallet && (
          <ActionButton
            tone="primary"
            disabled={walletInitiating || !walletConnected || walletMismatch || executionPayloadLoading}
            onClick={async () => {
              try {
                if (!walletConnected || !connectedWalletAddress) throw new Error('Connect the maker wallet first.');
                if (!walletProvider) throw new Error('Wallet provider is not available.');
                if (!executionPayload) throw new Error('Execution payload is not ready.');

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
                enqueueSnackbar(getErrorMessage(walletError, 'Wallet initiation failed'), { variant: 'error' });
              } finally {
                setWalletInitiating(false);
              }
            }}
          >
            {walletInitiating ? 'Initiating...' : 'Initiate with wallet'}
          </ActionButton>
        )}

        {canApproveWithWallet && (
          <ActionButton
            tone="primary"
            disabled={isSubmitting || !walletConnected || executionPayloadLoading}
            onClick={async () => {
              if (isSubmitting) return;

              let checkerPayload = null;
              let approvalConnection = null;

              try {
                if (!walletConnected || !connectedWalletAddress) {
                  throw new Error('Connect a registered checker wallet first.');
                }
                if (!walletProvider) throw new Error('Wallet provider is not available.');

                setIsSubmitting(true);

                const preparedResponse = await tokenRequestsApi.prepareCheckerApproval(
                  request.id,
                  connectedWalletAddress,
                );

                checkerPayload = preparedResponse.data;

                const checkerOnChainCheckers = Array.isArray(checkerPayload.onChainCheckers)
                  ? checkerPayload.onChainCheckers
                  : [];

                if (checkerOnChainCheckers.length && !checkerOnChainCheckers.includes(connectedWalletAddress)) {
                  throw new Error(`Connected wallet ${connectedWalletAddress} is not registered on chain.`);
                }

                if (!checkerPayload.approvalInstruction) {
                  throw new Error('Checker approval instruction was not returned by the backend.');
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
                const details = await collectApprovalErrorDetails(walletError);
                if (details.some(isAlreadyProcessedMessage)) {
                  enqueueSnackbar('This request has already been processed.', { variant: 'warning' });
                } else {
                  enqueueSnackbar(getErrorMessage(walletError, 'Checker wallet approval failed'), {
                    variant: 'error',
                  });
                }
              } finally {
                setIsSubmitting(false);
                if (approvalConnection || checkerPayload) await reload();
              }
            }}
          >
            {isSubmitting ? 'Approving...' : 'Approve on chain'}
          </ActionButton>
        )}

        {canExecuteRequest(user, request) && (
          <ActionButton
            tone="primary"
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
          >
            Execute on chain
          </ActionButton>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
            <div className="mb-6 flex flex-wrap gap-2">
              <StatusChip kind="type" value={request.requestType} />
              <StatusChip value={request.status} />
            </div>

            <h2 className="text-base font-semibold text-white">Request metadata</h2>

            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Token mint address">
                <span className="break-all font-mono">{truncateMiddle(request.tokenMintAddress, 10, 8)}</span>
              </Field>
              <Field label="Amount">{formatAmount(request.amount)}</Field>
              <Field label="Source wallet">{request.sourceWallet?.label || '-'}</Field>
              <Field label="Destination wallet">{request.destinationWallet?.label || '-'}</Field>
              <Field label="Maker">{request.makerUser?.fullName || '-'}</Field>
              <Field label="Checker">{request.checkerUser?.fullName || '-'}</Field>
              <Field label="Execution mode">{request.executionMode || EXECUTION_MODES.SERVER_MANAGED}</Field>
              <Field label="Maker wallet address">
                <span className="break-all font-mono">{request.makerWalletAddress || request.sourceWallet?.walletAddress || '-'}</span>
              </Field>
              <Field label="On-chain request">
                <span className="break-all font-mono">{request.onChainRequestAddress || '-'}</span>
              </Field>
              <Field label="Maker initiated">{formatDateTime(request.makerInitiatedAt)}</Field>
            </dl>

            <div className="mt-6 border-t border-white/10 pt-5">
              <Field label="Remarks">{request.remarks || 'No remarks provided'}</Field>
            </div>

            <div className="mt-6 space-y-3">
              {request.rejectionReason && <InfoAlert tone="error">Rejection reason: {request.rejectionReason}</InfoAlert>}
              {request.executionError && <InfoAlert tone="warning">Execution error: {request.executionError}</InfoAlert>}
              {executionPayloadLoading && <InfoAlert>Refreshing execution payload and wallet requirements...</InfoAlert>}
              {recoveringInitiation && <InfoAlert>Finalizing a previously signed maker wallet submission...</InfoAlert>}
              {executionPayloadError && <InfoAlert tone="warning">{executionPayloadError}</InfoAlert>}

              <InfoAlert>{getNextActorMessage(request, executionPayload)}</InfoAlert>

              {executionPayload?.walletInitiation?.supported && (
                <InfoAlert
                  tone={
                    walletMismatch
                      ? 'warning'
                      : executionPayload.walletInitiation.recorded
                        ? 'success'
                        : 'info'
                  }
                >
                  {executionPayload.walletInitiation.recorded
                    ? 'This request already has maker-side wallet initiation recorded.'
                    : walletMismatch
                      ? `Connected wallet ${connectedWalletAddress} does not match expected maker wallet ${expectedMakerWalletAddress}.`
                      : expectedMakerWalletAddress
                        ? `Ready for maker-side browser signing by ${expectedMakerWalletAddress}.`
                        : 'This request type supports maker-side browser initiation.'}
                </InfoAlert>
              )}

              {canApproveWithWallet && (
                <InfoAlert>
                  This request has maker initiation recorded. A registered checker wallet can approve it directly.
                </InfoAlert>
              )}

              {walletConnected && onChainCheckers.length && !connectedWalletRegisteredOnChain && (
                <InfoAlert tone="warning">
                  Connected Phantom wallet is not registered on chain as a checker.
                </InfoAlert>
              )}

              {onChainCheckers.length > 0 && (
                <InfoAlert tone={connectedWalletRegisteredOnChain ? 'success' : 'warning'}>
                  On-chain checkers: {onChainCheckers.join(', ')}
                </InfoAlert>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {request.initiationExplorerUrl && (
                <a
                  href={request.initiationExplorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-sky-400 hover:text-sky-300"
                >
                  View initiation transaction
                </a>
              )}

              {request.explorerUrl && (
                <a
                  href={request.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-sky-400 hover:text-sky-300"
                >
                  View explorer transaction
                </a>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-xl">
            <div className="border-b border-white/10 px-6 py-4">
              <h2 className="text-base font-semibold text-white">Approval history</h2>
            </div>

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
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
            <h2 className="mb-4 text-base font-semibold text-white">Request timeline</h2>
            <RequestTimeline items={timeline} request={request} />
          </section>

          <section className="rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
            <h2 className="mb-4 text-base font-semibold text-white">Timestamps</h2>
            <div className="space-y-3 text-sm text-zinc-300">
              <p>Created: {formatDateTime(request.createdAt)}</p>
              <p>Approved: {formatDateTime(request.approvedAt)}</p>
              <p>Rejected: {formatDateTime(request.rejectedAt)}</p>
              {/* <p>Executed: {formatDateTime(request.executedAt)}</p> */}
            </div>
          </section>

          <WalletConnectCard executionPayload={executionPayload} requestStatus={request.status} />
        </aside>
      </div>

      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/70" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold text-white">Reject request</DialogTitle>
              <button
                type="button"
                onClick={() => setRejectDialogOpen(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>

            <div className="mt-5">
              <label className="block text-sm font-medium text-zinc-300">Rejection reason</label>
              <textarea
                rows={4}
                value={formState.rejectionReason}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, rejectionReason: event.target.value }))
                }
                className="mt-2 block w-full rounded-lg border-0 bg-white/5 px-3 py-2.5 text-sm text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
              <ActionButton
                disabled={rejectSubmitting}
                onClick={() => {
                  setRejectDialogOpen(false);
                  setFormState({ rejectionReason: '' });
                }}
              >
                Cancel
              </ActionButton>

              <ActionButton
                tone="danger"
                disabled={rejectSubmitting}
                onClick={async () => {
                  try {
                    setRejectSubmitting(true);

                    if (!walletConnected || !connectedWalletAddress) {
                      throw new Error('Connect a checker wallet before rejecting this request.');
                    }

                    if (!walletProvider) throw new Error('Wallet provider is not available.');

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
                    setFormState({ rejectionReason: '' });
                    setRejectDialogOpen(false);
                    reload();
                  } catch (rejectionError) {
                    enqueueSnackbar(getErrorMessage(rejectionError, 'Unable to reject request'), {
                      variant: 'error',
                    });
                  } finally {
                    setRejectSubmitting(false);
                  }
                }}
              >
                {rejectSubmitting ? 'Processing...' : 'Confirm reject'}
              </ActionButton>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}

export default TokenRequestDetailsPage;
