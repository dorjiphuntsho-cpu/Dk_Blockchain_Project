import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import ErrorState from '../../components/common/ErrorState';
import InfoPanel from '../../components/common/InfoPanel';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import RequestTimeline from '../../components/common/RequestTimeline';
import StatusChip from '../../components/common/StatusChip';
import TypeChip from '../../components/common/TypeChip';
import Button from '../../components/ui/Button';
import { settlementsApi } from '../../modules/settlements/settlements.api';
import { getSettlementTimeline } from '../../modules/settlements/settlements.schemas';
import { REQUEST_STATUSES, SETTLEMENT_MODES } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/error';
import { formatAmount, truncateMiddle } from '../../utils/format';

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 min-w-0 break-all text-sm text-zinc-100">{children || '-'}</dd>
    </div>
  );
}

function SettlementDetailsPage() {
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();
  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

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

  const timeline = useMemo(() => getSettlementTimeline(settlement), [settlement]);
  const isBipsSettlement = settlement?.settlementMode === SETTLEMENT_MODES.BIPS_FIAT;
  const canRunInquiry = isBipsSettlement && [
    REQUEST_STATUSES.DRAFT,
    REQUEST_STATUSES.INQUIRY_FAILED,
  ].includes(settlement?.status);
  const canReconcile = isBipsSettlement && [
    REQUEST_STATUSES.BIPS_PENDING,
    REQUEST_STATUSES.MANUAL_REVIEW,
  ].includes(settlement?.status);
  const canReroute = settlement?.requestType === 'INTERBANK_TRANSFER';

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
        subtitle="Track route selection, BIPS references, and settlement progression across on-chain and fiat fallback stages."
      />

      <div className="flex flex-wrap gap-3">
        <Button disabled={submitting === 'route'} onClick={() => runAction('route', () => settlementsApi.route(settlement.id), 'Settlement route refreshed.')}>
          {submitting === 'route' ? 'Refreshing route...' : 'Refresh Route'}
        </Button>
        {canRunInquiry ? (
          <Button disabled={submitting === 'inquiry'} onClick={() => runAction('inquiry', () => settlementsApi.runInquiry(settlement.id), 'BIPS inquiry completed.')}>
            {submitting === 'inquiry' ? 'Running inquiry...' : 'Run Inquiry'}
          </Button>
        ) : null}
        {canReconcile ? (
          <Button disabled={submitting === 'reconcile'} onClick={() => runAction('reconcile', () => settlementsApi.reconcile(settlement.id), 'Settlement reconciled.')}>
            {submitting === 'reconcile' ? 'Reconciling...' : 'Reconcile'}
          </Button>
        ) : null}
        {canReroute ? (
          <Button disabled={submitting === 'route'} onClick={() => runAction('route-rerun', () => settlementsApi.route(settlement.id), 'Settlement route recalculated.')} variant="outline">
            Re-run Routing
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
            <div className="mb-6 flex flex-wrap gap-2">
              <TypeChip value={settlement.requestType} />
              <StatusChip value={settlement.status} />
              <StatusChip value={settlement.settlementMode} />
            </div>

            <dl className="grid gap-5 sm:grid-cols-2">
              <Field label="Source bank">{settlement.sourceBank?.name || '-'}</Field>
              <Field label="Destination bank">{settlement.destinationBank?.name || '-'}</Field>
              <Field label="Token mint">{truncateMiddle(settlement.tokenMintAddress || '-', 12, 8)}</Field>
              <Field label="Amount">{formatAmount(settlement.amount)}</Field>
              <Field label="Request ID">{settlement.requestId || '-'}</Field>
              <Field label="Reference number">{settlement.referenceNumber || '-'}</Field>
              <Field label="BIPS transaction ID">{settlement.bipsTransactionId || '-'}</Field>
              <Field label="Inquiry response">{settlement.inquiryResponseCode || settlement.inquiryResponseMessage || '-'}</Field>
              <Field label="Source account">{settlement.sourceAccountNumber || '-'}</Field>
              <Field label="Beneficiary account">{settlement.beneficiaryAccountNumber || '-'}</Field>
              <Field label="On-chain request">{settlement.onChainRequestAddress || '-'}</Field>
              <Field label="Execution signature">{settlement.txSignature || '-'}</Field>
            </dl>

            <div className="mt-6 border-t border-white/10 pt-5">
              <Field label="Transfer purpose">{settlement.transferPurpose || 'No purpose recorded'}</Field>
              {settlement.executionError ? (
                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  {settlement.executionError}
                </div>
              ) : null}
            </div>
          </section>

          <InfoPanel
            title="Routing and fiat details"
            subtitle="Operational values used for BIPS fallback, route decisions, and downstream reconciliation."
          >
            <dl className="grid gap-5 sm:grid-cols-2">
              <Field label="Settlement mode">{settlement.settlementMode?.replaceAll('_', ' ') || '-'}</Field>
              <Field label="Beneficiary bank code">{settlement.beneficiaryBankCode || '-'}</Field>
              <Field label="Beneficiary account name">{settlement.beneficiaryAccountName || '-'}</Field>
              <Field label="Source account name">{settlement.sourceAccountName || '-'}</Field>
              <Field label="Maker wallet">{settlement.makerWalletAddress || '-'}</Field>
              <Field label="Source token account">{settlement.sourceTokenAccountAddress || '-'}</Field>
              <Field label="Destination token account">{settlement.destinationTokenAccountAddress || '-'}</Field>
              <Field label="Explorer URL">{settlement.explorerUrl || '-'}</Field>
            </dl>
          </InfoPanel>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
            <h2 className="mb-4 text-base font-semibold text-white">Settlement timeline</h2>
            <RequestTimeline items={timeline} request={settlement} />
          </section>

          <InfoPanel title="Timestamps" subtitle="Useful for operations follow-up and manual review handoff.">
            <div className="space-y-3 text-sm text-zinc-300">
              <p>Created: {formatDateTime(settlement.createdAt)}</p>
              <p>Updated: {formatDateTime(settlement.updatedAt)}</p>
              <p>Maker initiated: {formatDateTime(settlement.makerInitiatedAt)}</p>
              <p>Executed: {formatDateTime(settlement.executedAt)}</p>
              <p>Settled: {formatDateTime(settlement.settledAt)}</p>
            </div>
          </InfoPanel>
        </aside>
      </div>
    </div>
  );
}

export default SettlementDetailsPage;
