import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/16/solid';
import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import ReserveBalancePanel from '../../components/cbs/ReserveBalancePanel';
import ErrorState from '../../components/common/ErrorState';
import InfoPanel from '../../components/common/InfoPanel';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import RequestTimeline from '../../components/common/RequestTimeline';
import StatusChip from '../../components/common/StatusChip';
import TypeChip from '../../components/common/TypeChip';
import WalletConnectCard from '../../components/wallet/WalletConnectCard';
import useAuth from '../../hooks/useAuth';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import { cbsApi } from '../../modules/cbs/cbs.api';
import {
  buildCheckerApprovalTransaction,
  buildExplorerTransactionUrl,
  buildMakerInitiationTransaction,
  signAndSendMakerTransaction,
  signAndSendWalletTransaction,
} from '../../modules/solana/walletExecution';
import { settlementsApi } from '../../modules/settlements/settlements.api';
import { getSettlementTimeline } from '../../modules/settlements/settlements.schemas';
import {
  clearPendingInitiationRecovery,
  getPendingInitiationRecovery,
  savePendingInitiationRecovery,
} from '../../modules/tokenRequests/tokenRequestRecovery';
import { rejectionSchema } from '../../modules/tokenRequests/tokenRequests.schemas';
import { getNextActorMessage } from '../../modules/tokenRequests/tokenRequests.utils';
import { REQUEST_STATUSES, ROLES, SETTLEMENT_MODES } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/error';
import { formatAmount, truncateMiddle } from '../../utils/format';

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 min-w-0 break-all text-sm text-zinc-100">{children}</dd>
    </div>
  );
}

function hasDisplayValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
}

function FieldGrid({ items = [] }) {
  const visibleItems = items.filter((item) => hasDisplayValue(item?.value));

  if (!visibleItems.length) {
    return null;
  }

  return (
    <dl className="grid gap-5 sm:grid-cols-2">
      {visibleItems.map((item) => (
        <Field key={item.label} label={item.label}>
          {item.value}
        </Field>
      ))}
    </dl>
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

function SettlementDetailsPage() {
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const {
    address: connectedWalletAddress,
    connected: walletConnected,
    provider: walletProvider,
  } = useSolanaWallet();

  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');
  const [reserveBalance, setReserveBalance] = useState(null);
  const [reserveBalanceLoading, setReserveBalanceLoading] = useState(false);
  const [reserveBalanceError, setReserveBalanceError] = useState('');
  const [walletPreparing, setWalletPreparing] = useState(false);
  const [recoveringInitiation, setRecoveringInitiation] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [formState, setFormState] = useState({ rejectionReason: '' });

  const loadSettlement = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await settlementsApi.getById(id);
      setSettlement(response.data);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load settlement.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadSettlement();
  }, [loadSettlement]);

  useEffect(() => {
    let cancelled = false;

    async function loadReserve() {
      if (!settlement || !['RESERVE_MINT', 'REPLENISHMENT_MINT'].includes(settlement.requestType)) {
        setReserveBalance(null);
        setReserveBalanceError('');
        setReserveBalanceLoading(false);
        return;
      }

      try {
        setReserveBalanceLoading(true);
        setReserveBalanceError('');
        const response = await cbsApi.getIssuerReserveBalance();
        if (!cancelled) {
          setReserveBalance(response.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setReserveBalance(null);
          setReserveBalanceError(getErrorMessage(loadError, 'Unable to load DK Bank reserve balance.'));
        }
      } finally {
        if (!cancelled) {
          setReserveBalanceLoading(false);
        }
      }
    }

    void loadReserve();
    return () => {
      cancelled = true;
    };
  }, [settlement]);

  useEffect(() => {
    async function recoverInitiation() {
      if (!settlement?.id || settlement.status !== REQUEST_STATUSES.DRAFT || recoveringInitiation) return;

      const recovery = getPendingInitiationRecovery(settlement.id);
      if (!recovery?.payload) return;

      try {
        setRecoveringInitiation(true);
        if (['RESERVE_MINT', 'REPLENISHMENT_MINT'].includes(settlement.requestType)) {
          await settlementsApi.recordMintInitiation(settlement.id, recovery.payload);
        } else if (settlement.requestType === 'INTERBANK_TRANSFER' && settlement.settlementMode === SETTLEMENT_MODES.ON_CHAIN_BTN) {
          await settlementsApi.recordTransferInitiation(settlement.id, recovery.payload);
        } else if (settlement.requestType === 'REDEMPTION') {
          await settlementsApi.recordBurnInitiation(settlement.id, recovery.payload);
        }
        clearPendingInitiationRecovery(settlement.id);
        enqueueSnackbar('Recovered previous wallet submission.', { variant: 'success' });
        await loadSettlement();
      } catch (recoveryError) {
        const message = getErrorMessage(recoveryError, 'Unable to recover previous wallet submission');
        if (/cannot record initiation|already processed|not found/i.test(message)) {
          clearPendingInitiationRecovery(settlement.id);
          await loadSettlement();
        }
      } finally {
        setRecoveringInitiation(false);
      }
    }

    void recoverInitiation();
  }, [enqueueSnackbar, loadSettlement, recoveringInitiation, settlement]);

  const timeline = useMemo(() => getSettlementTimeline(settlement), [settlement]);
  const isMintSettlement = ['RESERVE_MINT', 'REPLENISHMENT_MINT'].includes(settlement?.requestType);
  const isOnChainTransferSettlement =
    settlement?.requestType === 'INTERBANK_TRANSFER' && settlement?.settlementMode === SETTLEMENT_MODES.ON_CHAIN_BTN;
  const isBurnSettlement = settlement?.requestType === 'REDEMPTION';
  const isBipsSettlement = settlement?.settlementMode === SETTLEMENT_MODES.BIPS_FIAT;
  const canRunInquiry = isBipsSettlement && [REQUEST_STATUSES.DRAFT, REQUEST_STATUSES.INQUIRY_FAILED].includes(settlement?.status);
  const canReconcile = isBipsSettlement && [REQUEST_STATUSES.BIPS_PENDING, REQUEST_STATUSES.MANUAL_REVIEW].includes(settlement?.status);
  const canReroute = settlement?.requestType === 'INTERBANK_TRANSFER';
  const canInitiateWithWallet =
    Boolean(user?.roles?.includes(ROLES.MAKER))
    && [REQUEST_STATUSES.DRAFT, REQUEST_STATUSES.PENDING_APPROVAL].includes(settlement?.status)
    && (isMintSettlement || isOnChainTransferSettlement || isBurnSettlement)
    && !settlement?.onChainRequestAddress;
  const canApproveWithWallet =
    Boolean(user?.roles?.includes(ROLES.CHECKER))
    && settlement?.status === REQUEST_STATUSES.PENDING_APPROVAL
    && Boolean(settlement?.onChainRequestAddress)
    && (isMintSettlement || isOnChainTransferSettlement || isBurnSettlement);
  const canReject = Boolean(user?.roles?.includes(ROLES.CHECKER)) && settlement?.status === REQUEST_STATUSES.PENDING_APPROVAL;

  const executionPayload = useMemo(() => {
    const walletSupported = isMintSettlement || isOnChainTransferSettlement || isBurnSettlement;

    return {
      rpcUrl: null,
      walletInitiation: {
        supported: walletSupported,
        recorded: Boolean(settlement?.onChainRequestAddress),
        expectedMakerWalletAddress: settlement?.makerWalletAddress || null,
      },
      onChainCheckers: [],
    };
  }, [isBurnSettlement, isMintSettlement, isOnChainTransferSettlement, settlement]);

  const primaryDetails = useMemo(() => ([
    { label: 'Source bank', value: settlement?.sourceBank?.name },
    { label: 'Destination bank', value: settlement?.destinationBank?.name },
    { label: 'Token mint', value: settlement?.tokenMintAddress ? truncateMiddle(settlement.tokenMintAddress, 12, 8) : null },
    { label: 'Amount', value: hasDisplayValue(settlement?.amount) ? formatAmount(settlement.amount) : null },
    { label: 'Request ID', value: settlement?.requestId },
    { label: 'Reference number', value: settlement?.referenceNumber },
    { label: 'BIPS transaction ID', value: settlement?.bipsTransactionId },
    { label: 'Inquiry response', value: settlement?.inquiryResponseCode || settlement?.inquiryResponseMessage },
    { label: 'Source account', value: settlement?.sourceAccountNumber },
    { label: 'Beneficiary account', value: settlement?.beneficiaryAccountNumber },
    { label: 'On-chain request', value: settlement?.onChainRequestAddress },
    { label: 'Execution signature', value: settlement?.txSignature },
  ]), [settlement]);

  const routingDetails = useMemo(() => ([
    { label: 'Settlement mode', value: settlement?.settlementMode?.replaceAll('_', ' ') },
    { label: 'Beneficiary bank code', value: settlement?.beneficiaryBankCode },
    { label: 'Beneficiary account name', value: settlement?.beneficiaryAccountName },
    { label: 'Source account name', value: settlement?.sourceAccountName },
    { label: 'Maker wallet', value: settlement?.makerWalletAddress },
    { label: 'Source token account', value: settlement?.sourceTokenAccountAddress },
    { label: 'Destination token account', value: settlement?.destinationTokenAccountAddress },
    { label: 'Explorer URL', value: settlement?.explorerUrl || settlement?.initiationExplorerUrl },
  ]), [settlement]);

  const timestampDetails = useMemo(() => ([
    { label: 'Created', value: settlement?.createdAt ? formatDateTime(settlement.createdAt) : null },
    { label: 'Updated', value: settlement?.updatedAt ? formatDateTime(settlement.updatedAt) : null },
    { label: 'Maker initiated', value: settlement?.makerInitiatedAt ? formatDateTime(settlement.makerInitiatedAt) : null },
    { label: 'Executed', value: settlement?.executedAt ? formatDateTime(settlement.executedAt) : null },
    { label: 'Settled', value: settlement?.settledAt ? formatDateTime(settlement.settledAt) : null },
  ]), [settlement]);

  const runAction = async (key, runner, successMessage) => {
    try {
      setSubmitting(key);
      await runner();
      enqueueSnackbar(successMessage, { variant: 'success' });
      await loadSettlement();
    } catch (actionError) {
      enqueueSnackbar(getErrorMessage(actionError, 'Unable to update settlement'), { variant: 'error' });
    } finally {
      setSubmitting('');
    }
  };

  const ensureDestinationTokenAccount = async (transaction, checkerPayload, connection) => {
    const destinationWalletAddress =
      checkerPayload.destinationWallet?.walletAddress ||
      checkerPayload.destinationWalletAddress ||
      null;

    if (!destinationWalletAddress) return;

    const mintAddress = checkerPayload.tokenMintAddress || settlement?.tokenMintAddress;
    if (!mintAddress) return;

    const mintPublicKey = new PublicKey(mintAddress);
    const destinationWalletPublicKey = new PublicKey(destinationWalletAddress);
    const expectedDestinationAta = await getAssociatedTokenAddress(mintPublicKey, destinationWalletPublicKey);

    const configuredDestinationAddress =
      settlement?.destinationTokenAccountAddress ||
      checkerPayload.destinationTokenAccountAddress ||
      checkerPayload.destinationTokenAccount ||
      null;

    if (configuredDestinationAddress && configuredDestinationAddress !== expectedDestinationAta.toBase58()) return;

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

  const loadMakerPreparation = async () => {
    if (isMintSettlement) {
      return settlementsApi.prepareMintRequest(settlement.id, connectedWalletAddress);
    }

    if (isOnChainTransferSettlement) {
      return settlementsApi.prepareTransferRequest(settlement.id, connectedWalletAddress);
    }

    if (isBurnSettlement) {
      return settlementsApi.prepareBurnRequest(settlement.id, connectedWalletAddress);
    }

    throw new Error('This settlement does not support maker wallet initiation.');
  };

  const recordMakerInitiation = async (payload) => {
    if (isMintSettlement) {
      return settlementsApi.recordMintInitiation(settlement.id, payload);
    }

    if (isOnChainTransferSettlement) {
      return settlementsApi.recordTransferInitiation(settlement.id, payload);
    }

    if (isBurnSettlement) {
      return settlementsApi.recordBurnInitiation(settlement.id, payload);
    }

    throw new Error('This settlement does not support maker initiation recording.');
  };

  const loadCheckerPreparation = async () => {
    if (isMintSettlement) {
      return settlementsApi.prepareMintCheckerApproval(settlement.id, connectedWalletAddress);
    }

    if (isOnChainTransferSettlement) {
      return settlementsApi.prepareTransferCheckerApproval(settlement.id, connectedWalletAddress);
    }

    if (isBurnSettlement) {
      return settlementsApi.prepareBurnCheckerApproval(settlement.id, connectedWalletAddress);
    }

    throw new Error('This settlement does not support checker approval.');
  };

  const recordCheckerExecution = async (payload) => {
    if (isMintSettlement) {
      return settlementsApi.recordMintExecution(settlement.id, payload);
    }

    if (isOnChainTransferSettlement) {
      return settlementsApi.recordTransferExecution(settlement.id, payload);
    }

    if (isBurnSettlement) {
      return settlementsApi.recordBurnExecution(settlement.id, payload);
    }

    throw new Error('This settlement does not support execution recording.');
  };

  if (loading) {
    return <LoadingScreen message="Loading settlement..." />;
  }

  if (error || !settlement) {
    return <ErrorState description={error || 'Settlement is not available.'} onAction={loadSettlement} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={settlement.id}
        subtitle="Track route selection, wallet signing, checker action, and settlement progression across on-chain and fiat fallback stages."
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <ActionButton disabled={submitting === 'route'} onClick={() => runAction('route', () => settlementsApi.route(settlement.id), 'Settlement route refreshed.')}>
          {submitting === 'route' ? 'Refreshing route...' : 'Refresh Route'}
        </ActionButton>

        {canRunInquiry ? (
          <ActionButton disabled={submitting === 'inquiry'} onClick={() => runAction('inquiry', () => settlementsApi.runInquiry(settlement.id), 'BIPS inquiry completed.')}>
            {submitting === 'inquiry' ? 'Running inquiry...' : 'Run Inquiry'}
          </ActionButton>
        ) : null}

        {canReconcile ? (
          <ActionButton disabled={submitting === 'reconcile'} onClick={() => runAction('reconcile', () => settlementsApi.reconcile(settlement.id), 'Settlement reconciled.')}>
            {submitting === 'reconcile' ? 'Reconciling...' : 'Reconcile'}
          </ActionButton>
        ) : null}

        {canReroute ? (
          <ActionButton disabled={submitting === 'route-rerun'} onClick={() => runAction('route-rerun', () => settlementsApi.route(settlement.id), 'Settlement route recalculated.')}>
            {submitting === 'route-rerun' ? 'Re-routing...' : 'Re-run Routing'}
          </ActionButton>
        ) : null}

        {canInitiateWithWallet ? (
          <ActionButton
            tone="primary"
            disabled={walletPreparing || !walletConnected}
            onClick={async () => {
              try {
                if (!walletConnected || !connectedWalletAddress) {
                  throw new Error('Connect the maker wallet first.');
                }
                if (!walletProvider) throw new Error('Wallet provider is not available.');

                setWalletPreparing(true);

                const preparedResponse = await loadMakerPreparation();
                const preparedPayload = preparedResponse.data;
                const builtTransaction = await buildMakerInitiationTransaction({
                  executionPayload: preparedPayload,
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
                  initiationExplorerUrl: buildExplorerTransactionUrl(initiationSignature, preparedPayload.rpcUrl),
                };

                if (builtTransaction.sourceTokenAccountAddress) {
                  initiationPayload.sourceTokenAccountAddress = builtTransaction.sourceTokenAccountAddress;
                }

                if (builtTransaction.destinationTokenAccountAddress) {
                  initiationPayload.destinationTokenAccountAddress = builtTransaction.destinationTokenAccountAddress;
                }

                savePendingInitiationRecovery(settlement.id, initiationPayload);
                await recordMakerInitiation(initiationPayload);
                clearPendingInitiationRecovery(settlement.id);

                enqueueSnackbar(`Wallet initiation submitted: ${truncateMiddle(initiationSignature, 8, 6)}`, {
                  variant: 'success',
                });
                await loadSettlement();
              } catch (walletError) {
                enqueueSnackbar(getErrorMessage(walletError, 'Wallet initiation failed'), { variant: 'error' });
              } finally {
                setWalletPreparing(false);
              }
            }}
          >
            {walletPreparing ? 'Initiating...' : 'Initiate with wallet'}
          </ActionButton>
        ) : null}

        {canApproveWithWallet ? (
          <ActionButton
            tone="primary"
            disabled={walletPreparing || !walletConnected}
            onClick={async () => {
              try {
                if (!walletConnected || !connectedWalletAddress) {
                  throw new Error('Connect a checker wallet first.');
                }
                if (!walletProvider) throw new Error('Wallet provider is not available.');

                setWalletPreparing(true);

                const preparedResponse = await loadCheckerPreparation();
                const checkerPayload = preparedResponse.data;
                const builtTransaction = await buildCheckerApprovalTransaction({
                  executionPayload: checkerPayload,
                  checkerWalletAddress: connectedWalletAddress,
                  sourceWalletAddress: settlement.sourceWallet?.walletAddress || null,
                  destinationWalletAddress: settlement.destinationWallet?.walletAddress || null,
                  sourceTokenAccountAddress: settlement.sourceTokenAccountAddress || null,
                  destinationTokenAccountAddress: settlement.destinationTokenAccountAddress || null,
                });

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

                await recordCheckerExecution({
                  status: REQUEST_STATUSES.SETTLED,
                  txSignature: approvalSignature,
                  explorerUrl: buildExplorerTransactionUrl(approvalSignature, checkerPayload.rpcUrl),
                });

                enqueueSnackbar(`Checker approval submitted: ${truncateMiddle(approvalSignature, 8, 6)}`, {
                  variant: 'success',
                });
                await loadSettlement();
              } catch (walletError) {
                enqueueSnackbar(getErrorMessage(walletError, 'Checker wallet approval failed'), { variant: 'error' });
              } finally {
                setWalletPreparing(false);
              }
            }}
          >
            {walletPreparing ? 'Approving...' : 'Approve on chain'}
          </ActionButton>
        ) : null}

        {canReject ? (
          <ActionButton tone="danger" onClick={() => setRejectDialogOpen(true)}>
            Reject
          </ActionButton>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {isMintSettlement ? (
            <ReserveBalancePanel
              data={reserveBalance}
              error={reserveBalanceError}
              loading={reserveBalanceLoading}
              subtitle="Live DK Bank reserve fiat balance backing this mint settlement."
              title="DK Bank Fiat Reserve"
            />
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
            <div className="mb-6 flex flex-wrap gap-2">
              <TypeChip value={settlement.requestType} />
              <StatusChip value={settlement.status} />
              {settlement.settlementMode ? <StatusChip value={settlement.settlementMode} /> : null}
            </div>

            <FieldGrid items={primaryDetails} />

            <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
              {settlement.transferPurpose ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Transfer purpose</p>
                  <p className="mt-1 text-sm text-zinc-100">{settlement.transferPurpose}</p>
                </div>
              ) : null}

              <InfoAlert>{getNextActorMessage({ status: settlement.status }, executionPayload)}</InfoAlert>

              {executionPayload.walletInitiation.supported ? (
                <InfoAlert tone={executionPayload.walletInitiation.recorded ? 'success' : 'info'}>
                  {executionPayload.walletInitiation.recorded
                    ? 'Maker-side wallet initiation has already been recorded for this settlement.'
                    : 'This settlement is waiting for maker wallet initiation.'}
                </InfoAlert>
              ) : null}

              {settlement.executionError ? (
                <InfoAlert tone="warning">{settlement.executionError}</InfoAlert>
              ) : null}

              {recoveringInitiation ? (
                <InfoAlert>Finalizing a previously signed maker wallet submission...</InfoAlert>
              ) : null}
            </div>
          </section>

          <InfoPanel
            title="Routing and fiat details"
            subtitle="Operational values used for BIPS fallback, route decisions, and downstream reconciliation."
          >
            <FieldGrid items={routingDetails} />
          </InfoPanel>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
            <h2 className="mb-4 text-base font-semibold text-white">Settlement timeline</h2>
            <RequestTimeline items={timeline} request={settlement} />
          </section>

          <InfoPanel title="Timestamps" subtitle="Useful for operations follow-up and manual review handoff.">
            <FieldGrid items={timestampDetails} />
          </InfoPanel>

          <WalletConnectCard executionPayload={executionPayload} requestStatus={settlement.status} />
        </aside>
      </div>

      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold text-white">Reject settlement</DialogTitle>
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
                onChange={(event) => setFormState((current) => ({ ...current, rejectionReason: event.target.value }))}
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
                    const parsed = rejectionSchema.safeParse({
                      rejectionReason: formState.rejectionReason,
                      comment: formState.rejectionReason,
                    });

                    if (!parsed.success) {
                      throw new Error(parsed.error.issues[0]?.message || 'Rejection reason is required');
                    }

                    await settlementsApi.reject(settlement.id, parsed.data);

                    enqueueSnackbar('Settlement rejected', { variant: 'success' });
                    setFormState({ rejectionReason: '' });
                    setRejectDialogOpen(false);
                    await loadSettlement();
                  } catch (rejectionError) {
                    enqueueSnackbar(getErrorMessage(rejectionError, 'Unable to reject settlement'), {
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

export default SettlementDetailsPage;
