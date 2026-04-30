import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import ErrorState from '../../components/common/ErrorState';
import InfoPanel from '../../components/common/InfoPanel';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import Button from '../../components/ui/Button';
import Textarea from '../../components/ui/Textarea';
import useAuthStore from '../../modules/auth/auth.store';
import { reservesApi } from '../../modules/reserves/reserves.api';
import { rejectReserveSchema } from '../../modules/reserves/reserves.schemas';
import { ROLES } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/error';
import { formatAmount } from '../../utils/format';
import { hasRole } from '../../utils/permissions';

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 min-w-0 break-all text-sm text-zinc-100">{children || '-'}</dd>
    </div>
  );
}

function ReserveDetailsPage() {
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();
  const user = useAuthStore((state) => state.user);
  const [reserve, setReserve] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const canReview = hasRole(user, [ROLES.ADMIN, ROLES.CHECKER]) && reserve?.status === 'PENDING';

  const loadReserve = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await reservesApi.getById(id);
      setReserve(response.data);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load reserve.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadReserve();
  }, [loadReserve]);

  const runAction = async (key, runner, successMessage) => {
    try {
      setSubmitting(key);
      await runner();
      enqueueSnackbar(successMessage, { variant: 'success' });
      if (key === 'reject') {
        setRejectionReason('');
      }
      await loadReserve();
    } catch (actionError) {
      enqueueSnackbar(getErrorMessage(actionError, 'Unable to update reserve'), { variant: 'error' });
    } finally {
      setSubmitting('');
    }
  };

  const paymentSummary = useMemo(() => reserve?.paymentTransaction || null, [reserve]);

  if (loading) {
    return <LoadingScreen message="Loading reserve..." />;
  }

  if (error || !reserve) {
    return <ErrorState description={error || 'Reserve is not available.'} onAction={loadReserve} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={reserve.id}
        subtitle="Review the payment source, approval state, and available reserve capacity before reserve-backed issuance."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
            <div className="mb-6 flex flex-wrap gap-2">
              <StatusChip value={reserve.status} />
            </div>

            <dl className="grid gap-5 sm:grid-cols-2">
              <Field label="Bank">{reserve.bank?.name || '-'}</Field>
              <Field label="Source type">{reserve.referenceType}</Field>
              <Field label="Reference">{reserve.referenceId}</Field>
              <Field label="Currency">{reserve.currency || 'BTN'}</Field>
              <Field label="Amount">{formatAmount(reserve.amount)}</Field>
              <Field label="Available">{formatAmount(reserve.availableAmount)}</Field>
              <Field label="Locked">{formatAmount(reserve.lockedAmount)}</Field>
              <Field label="Consumed">{formatAmount(reserve.consumedAmount)}</Field>
              <Field label="Approved at">{formatDateTime(reserve.approvedAt)}</Field>
              <Field label="Released at">{formatDateTime(reserve.releasedAt)}</Field>
              <Field label="Consumed at">{formatDateTime(reserve.consumedAt)}</Field>
              <Field label="Created at">{formatDateTime(reserve.createdAt)}</Field>
            </dl>

            <div className="mt-6 border-t border-white/10 pt-5">
              <Field label="Remarks">{reserve.remarks || 'No remarks recorded'}</Field>
            </div>
          </section>

          <InfoPanel
            title="Payment source"
            subtitle="Underlying payment transaction used to create this reserve entry."
          >
            <dl className="grid gap-5 sm:grid-cols-2">
              <Field label="Gateway">{paymentSummary?.gatewayName || '-'}</Field>
              <Field label="Payment reference">{paymentSummary?.paymentReference || reserve.referenceId}</Field>
              <Field label="Gateway transaction ID">{paymentSummary?.gatewayTransactionId || '-'}</Field>
              <Field label="Customer reference">{paymentSummary?.customerReference || '-'}</Field>
              <Field label="Payer name">{paymentSummary?.payerName || '-'}</Field>
              <Field label="Payer account">{paymentSummary?.payerAccount || '-'}</Field>
              <Field label="Payment status">{paymentSummary?.status || '-'}</Field>
              <Field label="Confirmed at">{formatDateTime(paymentSummary?.confirmedAt)}</Field>
              <Field label="Last verified">{formatDateTime(paymentSummary?.lastVerifiedAt)}</Field>
              <Field label="Status message">{paymentSummary?.statusMessage || '-'}</Field>
            </dl>
          </InfoPanel>
        </div>

        <aside className="space-y-6">
          <InfoPanel
            title="Approval"
            subtitle="Checker/admin decision point before the reserve can be used in reserve minting."
          >
            {canReview ? (
              <div className="space-y-4">
                <Button
                  className="w-full"
                  disabled={submitting === 'approve'}
                  onClick={() => runAction('approve', () => reservesApi.approve(reserve.id), 'Reserve approved.')}
                >
                  {submitting === 'approve' ? 'Approving...' : 'Approve Reserve'}
                </Button>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-zinc-200">Rejection reason</span>
                  <Textarea
                    placeholder="Explain why this reserve should be rejected"
                    rows={5}
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                  />
                </label>

                <Button
                  className="w-full"
                  disabled={submitting === 'reject'}
                  onClick={() => {
                    const parsed = rejectReserveSchema.safeParse({ rejectionReason });
                    if (!parsed.success) {
                      enqueueSnackbar(parsed.error.issues[0]?.message || 'Rejection reason is required', {
                        variant: 'error',
                      });
                      return;
                    }

                    void runAction(
                      'reject',
                      () => reservesApi.reject(reserve.id, parsed.data),
                      'Reserve rejected.',
                    );
                  }}
                  variant="outline"
                >
                  {submitting === 'reject' ? 'Rejecting...' : 'Reject Reserve'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-zinc-300">
                <p>Status: {reserve.status}</p>
                <p>Approved at: {formatDateTime(reserve.approvedAt)}</p>
                <p>Created at: {formatDateTime(reserve.createdAt)}</p>
              </div>
            )}
          </InfoPanel>
        </aside>
      </div>
    </div>
  );
}

export default ReserveDetailsPage;
