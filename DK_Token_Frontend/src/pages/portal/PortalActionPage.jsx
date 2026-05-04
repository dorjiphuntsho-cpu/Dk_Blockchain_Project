import { useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import usePortalAuth from '../../hooks/usePortalAuth';
import { portalApi } from '../../modules/portal/portal.api';
import { getErrorMessage } from '../../utils/error';
import { formatAmount, truncateMiddle } from '../../utils/format';

const ACTION_CONFIG = {
  buy: {
    title: 'Buy BTN',
    summary: 'Move fiat into DK Bank and request BTN issuance to your customer balance.',
    buttonLabel: 'Submit Buy Request',
    helper: 'Use this flow after the customer confirms the source account and funding amount.',
    fields: [
      { name: 'amount', label: 'BTN Coin Amount', placeholder: '250.00' },
      { name: 'debitAccount', label: 'Account Number', placeholder: '100100365856' },
    ],
  },
  sell: {
    title: 'Sell BTN',
    summary: 'Payout fiat to the customer and record the required BTN return back into DK distribution inventory.',
    buttonLabel: 'Submit Sell Request',
    helper: 'This flow pays out fiat first. After payout confirmation, the customer must return the sold BTN amount back to the DK distribution wallet.',
    fields: [
      { name: 'amount', label: 'BTN Amount to Sell', placeholder: '100.00' },
      { name: 'payoutAccount', label: 'Payout Account Number', placeholder: '100100223740' },
    ],
  },
  redeem: {
    title: 'Redeem BTN',
    summary: 'Start a reserve-backed redemption instruction for eligible customer holdings.',
    buttonLabel: 'Submit Redemption Request',
    helper: 'This flow is appropriate when the customer wants BTN redeemed against fiat-backed reserve value.',
    fields: [
      { name: 'amount', label: 'BTN Amount to Redeem', placeholder: '75.00' },
      { name: 'beneficiaryName', label: 'Beneficiary Name', placeholder: 'Rinzin Jamtsho' },
      { name: 'beneficiaryAccount', label: 'Beneficiary Account Number', placeholder: '100100148337' },
      { name: 'narration', label: 'Narration', placeholder: 'BTN redemption payout' },
    ],
  },
  transfer: {
    title: 'Transfer BTN',
    summary: 'Move BTN from one customer holder to another without opening the admin portal.',
    buttonLabel: 'Submit Transfer Request',
    helper: 'Capture the receiving wallet or beneficiary account details for the customer transfer.',
    fields: [
      { name: 'amount', label: 'BTN Amount to Transfer', placeholder: '40.00' },
      { name: 'recipientName', label: 'Recipient Name', placeholder: 'Sonam Choden' },
      { name: 'recipientWallet', label: 'Recipient Wallet / Account', placeholder: 'wallet-or-account-id' },
      { name: 'remarks', label: 'Remarks', placeholder: 'Family transfer' },
    ],
  },
};

function buildInitialValues(fields) {
  return fields.reduce((accumulator, field) => ({ ...accumulator, [field.name]: '' }), {});
}

function PortalActionPage({ mode }) {
  const config = ACTION_CONFIG[mode];
  const initialValues = useMemo(() => buildInitialValues(config.fields), [config.fields]);
  const [values, setValues] = useState(initialValues);
  const [lastSubmission, setLastSubmission] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [submissionError, setSubmissionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const { token, customer } = usePortalAuth();

  useEffect(() => {
    setValues(initialValues);
    setLastSubmission(null);
    setPaymentDetails(null);
    setSubmissionError('');
  }, [initialValues, mode]);

  useEffect(() => {
    if (mode !== 'buy' && mode !== 'sell') {
      return;
    }

    if (!customer?.linkedBankAccountNumber) {
      return;
    }

    setValues((current) => ({
      ...current,
      debitAccount: current.debitAccount || customer.linkedBankAccountNumber,
      payoutAccount: current.payoutAccount || customer.linkedBankAccountNumber,
    }));
  }, [customer?.linkedBankAccountNumber, mode]);

  const handleChange = (fieldName, nextValue) => {
    setValues((current) => ({
      ...current,
      [fieldName]: nextValue,
    }));
  };

  const loadPaymentDetails = async (paymentReference) => {
    const response = await portalApi.getCustomerPayment(token, paymentReference);

    setPaymentDetails(response.data);
    return response.data;
  };

  const verifyAndReloadPaymentDetails = async (paymentReference) => {
    try {
      await portalApi.verifyCustomerPaymentStatus(token, paymentReference);
    } catch (error) {
      console.warn('Customer payment status verification did not complete yet', error);
    }

    return loadPaymentDetails(paymentReference);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmissionError('');
    setLastSubmission(values);

    if (mode !== 'buy' && mode !== 'sell') {
      enqueueSnackbar(`${config.title} request captured in portal UI`, { variant: 'success' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = mode === 'buy'
        ? await portalApi.buyBtn(token, {
            amount: values.amount,
            debitAccount: values.debitAccount,
          })
        : await portalApi.sellBtn(token, {
            amount: values.amount,
            payoutAccount: values.payoutAccount,
          });

      const transaction = response.data;
      await loadPaymentDetails(transaction.paymentReference);
      await verifyAndReloadPaymentDetails(transaction.paymentReference);
      window.dispatchEvent(new CustomEvent('portal-summary-refresh'));
      enqueueSnackbar(mode === 'buy' ? 'BTN buy request submitted successfully' : 'BTN sell request submitted successfully', { variant: 'success' });
    } catch (error) {
      const fallbackMessage = mode === 'buy'
        ? 'Unable to submit BTN buy request'
        : 'Unable to submit BTN sell request';
      const message = getErrorMessage(error, fallbackMessage);
      setSubmissionError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const buySummaryRows = paymentDetails
    ? [
      { label: 'Payment reference', value: paymentDetails.paymentReference },
      { label: 'Status', value: paymentDetails.status || '-' },
      { label: 'Amount', value: `${paymentDetails.currency || 'BTN'} ${formatAmount(paymentDetails.amount)}` },
      { label: 'Customer reference', value: truncateMiddle(paymentDetails.customerReference, 12, 8) },
      { label: 'Payer account', value: paymentDetails.payerAccount || '-' },
      {
        label: 'Token delivery',
        value:
          paymentDetails.parsedPayload?.fulfillment?.status
          || (paymentDetails.status === 'INITIATED' ? 'Waiting for payment confirmation' : 'Not started'),
      },
      {
        label: 'Delivery message',
        value: paymentDetails.parsedPayload?.fulfillment?.error || paymentDetails.statusMessage || '-',
      },
    ]
    : [];
  const sellSummaryRows = paymentDetails
    ? [
      { label: 'Payment reference', value: paymentDetails.paymentReference },
      { label: 'Payout status', value: paymentDetails.status || '-' },
      { label: 'Payout amount', value: `${paymentDetails.currency || 'BTN'} ${formatAmount(paymentDetails.amount)}` },
      { label: 'Customer reference', value: truncateMiddle(paymentDetails.customerReference, 12, 8) },
      { label: 'Reserve payout account', value: paymentDetails.payerAccount || '-' },
      { label: 'Token return status', value: paymentDetails.parsedPayload?.fulfillment?.status || 'Waiting for payout confirmation' },
      {
        label: 'Return destination wallet',
        value: paymentDetails.parsedPayload?.distributionWalletAddress || '-',
      },
      {
        label: 'Return destination token account',
        value: paymentDetails.parsedPayload?.distributionTokenAccountAddress || '-',
      },
      {
        label: 'Status message',
        value: paymentDetails.parsedPayload?.fulfillment?.error || paymentDetails.statusMessage || '-',
      },
    ]
    : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="rounded-[1.75rem] border-white/10 bg-zinc-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">{config.title}</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">{config.summary}</h2>
        <p className="mt-4 text-sm leading-7 text-zinc-400">{config.helper}</p>

        {(mode === 'buy' || mode === 'sell') && customer?.linkedBankAccountNumber ? (
          <div className="mt-6 rounded-[1.25rem] border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">
              {mode === 'buy' ? 'Linked funding account' : 'Linked payout account'}
            </p>
            <p className="mt-2 font-mono text-white">{customer.linkedBankAccountNumber}</p>
          </div>
        ) : null}

        {submissionError ? (
          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {submissionError}
          </div>
        ) : null}

        <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
          {config.fields.map((field) => (
            <label className="grid gap-2" key={field.name}>
              <span className="text-sm font-medium text-zinc-200">{field.label}</span>
              <Input
                disabled={isSubmitting}
                onChange={(event) => handleChange(field.name, event.target.value)}
                placeholder={field.placeholder}
                value={values[field.name]}
              />
            </label>
          ))}

          <div className="pt-2">
            <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
              {isSubmitting ? 'Submitting...' : config.buttonLabel}
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-6">
        <Card className="rounded-[1.75rem] border-emerald-400/15 bg-emerald-400/[0.06]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Integration boundary</p>
          <p className="mt-3 text-sm leading-7 text-zinc-200">
            Buy now initiates customer funding, verifies status, and delivers BTN from the distribution account. Sell now initiates fiat payout, verifies status, and records the required BTN return details. Redeem and transfer remain UI-only placeholders until their backend orchestration is added.
          </p>
        </Card>

        <Card className="rounded-[1.75rem] border-white/10 bg-zinc-950/70">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            {mode === 'buy' ? 'Latest payment status' : mode === 'sell' ? 'Latest sell status' : 'Latest submission preview'}
          </p>

          {(mode === 'buy' || mode === 'sell') && paymentDetails ? (
            <div className="mt-4 grid gap-3">
              {(mode === 'buy' ? buySummaryRows : sellSummaryRows).map((row) => (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3" key={row.label}>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{row.label}</p>
                  <p className="mt-1 break-all text-sm text-white">{row.value || '-'}</p>
                </div>
              ))}
            </div>
          ) : lastSubmission ? (
            <div className="mt-4 grid gap-3">
              {Object.entries(lastSubmission).map(([key, value]) => (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3" key={key}>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{key}</p>
                  <p className="mt-1 text-sm text-white">{value || '-'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              {mode === 'buy'
                ? 'After submission, the generated payment reference and current gateway-tracked status will appear here when the gateway callback updates the backend.'
                : mode === 'sell'
                  ? 'After submission, the generated payout reference, payout status, and BTN return destination details will appear here.'
                : 'Submitted customer actions will appear here so the flow can be reviewed before wiring to backend APIs.'}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

export default PortalActionPage;
