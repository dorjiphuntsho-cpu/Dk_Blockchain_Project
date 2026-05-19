import { useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createApproveInstruction } from '@solana/spl-token';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import usePortalAuth from '../../hooks/usePortalAuth';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import { portalApi } from '../../modules/portal/portal.api';
import { signAndSendWalletTransaction } from '../../modules/solana/walletExecution';
import { getErrorMessage } from '../../utils/error';
import { cn } from '../../utils/cn';
import { formatAmount, truncateMiddle } from '../../utils/format';
import { SOLANA_RPC_URL } from '../../utils/constants';

const Spinner = ({ className = 'size-4' }) => (
  <span
    aria-hidden="true"
    className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
  />
);

const ACTION_CONFIG = {
  buy: {
    title: 'Buy BTN',
    summary: 'Move fiat into DK Bank and request BTN issuance to your customer balance.',
    buttonLabel: 'Buy BTN Coin ',
    helper: 'Use this flow after the customer confirms the source account and funding amount.',
    fields: [
      { name: 'amount', label: 'BTN Coin Amount', placeholder: '250.00' },
      { name: 'debitAccount', label: 'Account Number', placeholder: '100100365856' },
      { name: 'phoneNumber', label: 'Phone Number', placeholder: '17811440' },
    ],
  },
  sell: {
    title: 'Sell BTN',
    summary: 'Payout fiat to the customer and return BTN back into DK distribution inventory automatically.',
    buttonLabel: 'Sell BTN Coin',
    helper: 'This flow pays out fiat and then automatically returns the sold BTN amount back to the DK distribution wallet from the delegated customer wallet.',
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
    summary: 'Transfer BTN directly to another customer wallet, or fall back to fiat payout if the recipient has no wallet.',
    buttonLabel: ' Transfer BTN Coin ',
    helper: 'If the recipient has an active wallet, BTN is transferred there directly. Otherwise the recipient receives fiat and the sender BTN is returned to DK distribution inventory.',
    fields: [
      { name: 'amount', label: 'BTN Amount to Transfer', placeholder: '40.00' },
      { name: 'recipientCid', label: 'Recipient CID', placeholder: '11101000002' },
    ],
  },
};

function buildInitialValues(fields) {
  return fields.reduce((accumulator, field) => ({ ...accumulator, [field.name]: '' }), {});
}

function getAccountByNumber(accounts, accountNumber) {
  return accounts.find((account) => account.accountNumber === accountNumber) || null;
}

function buildTransferFallbackMessage(paymentDetails) {
  const payoutAccountNumber = paymentDetails?.parsedPayload?.payoutAccountNumber;
  return payoutAccountNumber
    ? `Recipient does not have a wallet right now. The transfer has been switched to the registered fiat account ${payoutAccountNumber} instead of BTN.`
    : 'Recipient does not have a wallet right now. The transfer has been switched to the registered fiat account instead of BTN.';
}

function PortalActionPage({ mode }) {
  const config = ACTION_CONFIG[mode];
  const [values, setValues] = useState(() => buildInitialValues(config.fields));

  const [lastSubmission, setLastSubmission] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [submissionError, setSubmissionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState(null);
  const [isApprovingDelegation, setIsApprovingDelegation] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const { token, customer } = usePortalAuth();
  const solanaWallet = useSolanaWallet();
  const linkedBankAccounts = summary?.customer?.linkedBankAccounts || customer?.linkedBankAccounts || [];

  useEffect(() => {
    setValues(buildInitialValues(ACTION_CONFIG[mode].fields));
    setLastSubmission(null);
    setPaymentDetails(null);
    setSubmissionError('');
  }, [mode]);

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async () => {
      if (!token) {
        return;
      }

      try {
        const response = await portalApi.getSummary(token);
        if (isMounted) {
          setSummary(response.data);
        }
      } catch {
        if (isMounted) {
          setSummary(null);
        }
      }
    };

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [token, mode]);

  useEffect(() => {
    if (mode !== 'buy' && mode !== 'sell') {
      return;
    }

    const defaultLinkedAccount = linkedBankAccounts.find((account) => account.isPrimary)
      || linkedBankAccounts[0]
      || null;
    const defaultAccountNumber = defaultLinkedAccount?.accountNumber || customer?.linkedBankAccountNumber || '';

    if (!defaultAccountNumber) {
      return;
    }

    setValues((current) => ({
      ...current,
      debitAccount: linkedBankAccounts.some((account) => account.accountNumber === current.debitAccount)
        ? current.debitAccount
        : defaultAccountNumber,
      payoutAccount: linkedBankAccounts.some((account) => account.accountNumber === current.payoutAccount)
        ? current.payoutAccount
        : defaultAccountNumber,
    }));
  }, [customer?.linkedBankAccountNumber, linkedBankAccounts, mode]);

  const handleChange = (fieldName, nextValue) => {
    setValues((current) => ({
      ...current,
      [fieldName]: nextValue,
    }));
  };

  const selectedBuyAccount = mode === 'buy' ? getAccountByNumber(linkedBankAccounts, values.debitAccount) : null;
  const selectedSellAccount = mode === 'sell' ? getAccountByNumber(linkedBankAccounts, values.payoutAccount) : null;
  const issuerBankCode = summary?.linkedBank?.code || null;
  const requiresBuyPhoneNumber = mode === 'buy'
    && Boolean(selectedBuyAccount?.bankCode)
    && Boolean(issuerBankCode)
    && selectedBuyAccount.bankCode !== issuerBankCode;

  const visibleFields = config.fields.filter((field) => (
    !(mode === 'buy' && field.name === 'phoneNumber' && !requiresBuyPhoneNumber)
  ));

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

  const refreshSummary = async () => {
    if (!token) {
      return null;
    }

    const response = await portalApi.getSummary(token);
    setSummary(response.data);
    window.dispatchEvent(new CustomEvent('portal-summary-refresh'));
    return response.data;
  };

  const handleApproveSellDelegation = async () => {
    const currentSummary = summary || await refreshSummary();
    const delegation = currentSummary?.customer?.sellDelegation;
    const customerWalletAddress = currentSummary?.customer?.primaryWalletAddress || customer?.wallets?.[0]?.walletAddress || null;

    if (!delegation?.tokenAccountAddress || !delegation?.delegateWalletAddress || !customerWalletAddress) {
      enqueueSnackbar(`${mode === 'sell' ? 'Sell' : 'Transfer'} delegation metadata is not available for this customer wallet yet.`, { variant: 'error' });
      return;
    }

    let activeWalletAddress = solanaWallet.address;
    const walletAlreadyConnected = solanaWallet.connected && Boolean(activeWalletAddress);

    if (!walletAlreadyConnected) {
      activeWalletAddress = await solanaWallet.connect();
    }

    if (!activeWalletAddress) {
      enqueueSnackbar(`Connect the customer Phantom wallet before enabling automatic ${mode}.`, {
        variant: 'warning',
      });
      return;
    }

    if (activeWalletAddress !== customerWalletAddress) {
      enqueueSnackbar(`Connected wallet must match the customer wallet ${customerWalletAddress}.`, { variant: 'error' });
      return;
    }

    try {
      setIsApprovingDelegation(true);
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const transaction = new Transaction();
      transaction.add(
        createApproveInstruction(
          new PublicKey(delegation.tokenAccountAddress),
          new PublicKey(delegation.delegateWalletAddress),
          new PublicKey(customerWalletAddress),
          BigInt('18446744073709551615'),
        ),
      );

      await signAndSendWalletTransaction({
        connection,
        provider: solanaWallet.provider,
        transaction,
      });

      await refreshSummary();
      enqueueSnackbar(`Automatic ${mode} delegation enabled for this wallet.`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, `Unable to enable automatic ${mode} delegation`), { variant: 'error' });
    } finally {
      setIsApprovingDelegation(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmissionError('');
    setLastSubmission(values);

    if (mode !== 'buy' && mode !== 'sell' && mode !== 'transfer') {
      enqueueSnackbar(`${config.title} request captured in portal UI`, { variant: 'success' });
      return;
    }

    setIsSubmitting(true);

    try {
      if ((mode === 'sell' || mode === 'transfer') && !sellDelegationReady) {
        throw new Error(
          `Enable automatic ${mode === 'sell' ? 'sell' : 'transfer'} delegation for the customer wallet before submitting this request.`,
        );
      }

      let response;
      if (mode === 'buy') {
        const payload = {
          amount: values.amount,
          debitAccount: values.debitAccount,
        };
        if (requiresBuyPhoneNumber) {
          payload.phoneNumber = values.phoneNumber;
        }
        response = await portalApi.buyBtn(token, payload);
      } else if (mode === 'sell') {
        response = await portalApi.sellBtn(token, {
          amount: values.amount,
          payoutAccount: values.payoutAccount,
        });
      } else {
        response = await portalApi.transferBtn(token, {
          amount: values.amount,
          recipientCid: values.recipientCid,
        });
      }

      const transaction = response.data;
      await loadPaymentDetails(transaction.paymentReference);
      let nextPaymentDetails;
      if (
        transaction.mode === 'FIAT_FALLBACK'
        || mode === 'sell'
        || (mode === 'buy' && transaction.transaction?.parsedPayload?.buyRail !== 'PULL_PAYMENT')
      ) {
        nextPaymentDetails = await verifyAndReloadPaymentDetails(transaction.paymentReference);
      } else {
        nextPaymentDetails = await loadPaymentDetails(transaction.paymentReference);
      }
      await refreshSummary();
      if (mode === 'transfer' && transaction.mode === 'FIAT_FALLBACK') {
        enqueueSnackbar(buildTransferFallbackMessage(nextPaymentDetails), { variant: 'warning' });
      } else {
        enqueueSnackbar(
          mode === 'buy'
            ? 'BTN buy authorization submitted successfully'
            : mode === 'sell'
              ? 'BTN sell request submitted successfully'
              : 'BTN transfer request submitted successfully',
          { variant: 'success' },
        );
      }
    } catch (error) {
      const fallbackMessage = mode === 'buy'
        ? 'Unable to submit BTN buy request'
        : mode === 'sell'
          ? 'Unable to submit BTN sell request'
          : 'Unable to submit BTN transfer request';
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
          || (paymentDetails.status === 'INITIATED'
            ? 'Waiting for payment confirmation'
            : 'Not started'),
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
      { label: 'Payout rail', value: paymentDetails.parsedPayload?.payoutRail || paymentDetails.gatewayName || '-' },
      { label: 'Payout amount', value: `${paymentDetails.currency || 'BTN'} ${formatAmount(paymentDetails.amount)}` },
      { label: 'Customer reference', value: truncateMiddle(paymentDetails.customerReference, 12, 8) },
      {
        label: 'Payout bank',
        value: paymentDetails.parsedPayload?.payoutBankName
          || paymentDetails.parsedPayload?.payoutBankCode
          || '-',
      },
      { label: 'Reserve payout account', value: paymentDetails.payerAccount || '-' },
      { label: 'Beneficiary payout account', value: paymentDetails.parsedPayload?.payoutAccountNumber || '-' },
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
  const transferSummaryRows = paymentDetails
    ? [
      { label: 'Transfer reference', value: paymentDetails.paymentReference },
      { label: 'Status', value: paymentDetails.status || '-' },
      { label: 'Transfer mode', value: paymentDetails.parsedPayload?.transferMode || '-' },
      {
        label: 'BTN amount',
        value: `${paymentDetails.parsedPayload?.tokenSymbol || 'BTN'} ${formatAmount(paymentDetails.parsedPayload?.tokenAmount || 0)}`,
      },
      {
        label: 'Recipient',
        value: [
          paymentDetails.parsedPayload?.recipientName,
          paymentDetails.parsedPayload?.recipientCid && `CID ${paymentDetails.parsedPayload.recipientCid}`,
        ].filter(Boolean).join(' - ') || '-',
      },
      {
        label: paymentDetails.parsedPayload?.transferMode === 'WALLET' ? 'Recipient wallet' : 'Recipient payout account',
        value:
          paymentDetails.parsedPayload?.recipientWalletAddress
          || paymentDetails.parsedPayload?.payoutAccountNumber
          || '-',
      },
      {
        label: paymentDetails.parsedPayload?.transferMode === 'WALLET' ? 'Transfer result' : 'Fiat payout / token return',
        value: paymentDetails.parsedPayload?.fulfillment?.status || paymentDetails.statusMessage || '-',
      },
      {
        label: 'Status message',
        value: paymentDetails.parsedPayload?.fulfillment?.error
          || paymentDetails.parsedPayload?.fulfillment?.statusMessage
          || paymentDetails.statusMessage
          || '-',
      },
    ]
    : [];
  const sellDelegation = summary?.customer?.sellDelegation || null;
  const sellDelegationReady = Boolean(sellDelegation?.sufficient || sellDelegation?.active);
  const sellDelegationMetadataReady = Boolean(
    summary?.customer?.sellDelegation?.tokenAccountAddress
    && summary?.customer?.sellDelegation?.delegateWalletAddress
    && (summary?.customer?.primaryWalletAddress || customer?.wallets?.[0]?.walletAddress),
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-[var(--border)] bg-[var(--bg-secondary)]">
        <p className="fintech-label text-[#F0B90B]">{config.title}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">{config.summary}</h2>
        <p className="mt-2 text-sm text-[#848E9C]">{config.helper}</p>

        {mode === 'transfer' && paymentDetails?.parsedPayload?.transferMode === 'FIAT_FALLBACK' ? (
          <div className="mt-4 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {buildTransferFallbackMessage(paymentDetails)}
          </div>
        ) : null}

        {(mode === 'buy' || mode === 'sell') && linkedBankAccounts.length ? (
          <div className="mt-4 rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
            <p className="fintech-label text-[#F0B90B]">
              {mode === 'buy' ? 'Available funding accounts' : 'Available payout accounts'}
            </p>
            <div className="mt-3 grid gap-2">
              {linkedBankAccounts.map((account) => {
                const isSelected = mode === 'buy'
                  ? selectedBuyAccount?.accountNumber === account.accountNumber
                  : selectedSellAccount?.accountNumber === account.accountNumber;
                return (
                  <div
                    className={cn(
                      'rounded-[6px] border px-4 py-[14px] transition duration-150 ease-out',
                      isSelected
                        ? 'border-[var(--accent-gold)] bg-[rgba(240,185,11,0.06)]'
                        : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[#4a5260]',
                    )}
                    key={`${account.bankId || 'legacy'}-${account.accountNumber}`}
                  >
                    <p className="text-sm text-white">
                      {account.bankName || 'Bank'}
                      {account.bankCode ? ` (${account.bankCode})` : ''}
                      {account.isPrimary ? ' - Primary' : ''}
                    </p>
                    <p className="mt-1 font-mono text-sm text-zinc-300">{account.accountNumber}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {(mode === 'sell' || mode === 'transfer') ? (
          <div className="mt-4 rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
            <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary)]">
              {mode === 'sell' ? 'Automatic sell delegation' : 'Automatic transfer delegation'}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {sellDelegationReady
                ? `This customer wallet has already delegated BTN transfer authority for automatic ${mode} execution.`
                : `Enable a one-time wallet delegation so BTN can be moved automatically during ${mode} execution.`}
            </p>
            <div className="mt-3 grid gap-2 text-sm text-zinc-400">
              <p>Customer wallet: <span className="break-all text-zinc-200">{summary?.customer?.primaryWalletAddress || '-'}</span></p>
              <p>Delegate wallet: <span className="break-all text-zinc-200">{sellDelegation?.delegateWalletAddress || '-'}</span></p>
              <p>Delegated amount: <span className="text-zinc-200">{sellDelegation?.delegatedAmount || '0'}</span></p>
              {sellDelegation?.warning ? (
                <p className="text-amber-200/80">{sellDelegation.warning}</p>
              ) : null}
            </div>
            <div className="mt-4">
              <Button
                className="w-full border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--accent-gold)] hover:bg-transparent hover:text-[var(--accent-gold)]"
                disabled={isApprovingDelegation || !solanaWallet.available || !summary}
                onClick={handleApproveSellDelegation}
                type="button"
                variant="outline"
              >
                {isApprovingDelegation ? <Spinner /> : null}
                {isApprovingDelegation
                  ? 'Approving...'
                  : !summary
                    ? 'Loading wallet metadata...'
                    : !solanaWallet.connected
                      ? 'Connect Wallet'
                      : sellDelegationReady
                        ? 'Refresh delegation'
                        : `Enable Automatic ${mode === 'sell' ? 'Sell' : 'Transfer'}`}
              </Button>
            </div>
            {!solanaWallet.connected ? (
              <p className="mt-3 text-sm text-zinc-400">
                Connect the customer Phantom wallet before enabling automatic {mode}. This prevents an extra wallet authorization prompt during transaction signing.
              </p>
            ) : null}
            {!sellDelegationMetadataReady && summary ? (
              <p className="mt-3 text-sm text-amber-200/80">
                Wallet delegation metadata is still loading. If this persists after a refresh, the customer wallet may not have a BTN token account yet.
              </p>
            ) : null}
          </div>
        ) : null}

        {submissionError ? (
          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {submissionError}
          </div>
        ) : null}

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          {visibleFields.map((field) => (
            <label className="grid gap-2" key={field.name}>
              <span className="text-sm font-medium text-zinc-200">{field.label}</span>

              {((mode === 'buy' && field.name === 'debitAccount') || (mode === 'sell' && field.name === 'payoutAccount')) && linkedBankAccounts.length ? (
                <Select disabled={isSubmitting} name={field.name} onChange={(event) => handleChange(field.name, event.target.value)} value={values[field.name] ?? ''}>
                  <option value="" disabled>
                    {mode === 'buy' ? 'Select funding account' : 'Select payout account'}
                  </option>
                  {linkedBankAccounts.map((account) => (
                    <option key={`${account.bankId || 'legacy'}-${account.accountNumber}`} value={account.accountNumber}>
                      {`${account.bankName || 'Bank'}${account.bankCode ? ` (${account.bankCode})` : ''} - ${account.accountNumber}`}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  disabled={isSubmitting}
                  onChange={(event) => handleChange(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  value={values[field.name] ?? ""}
                />
              )}
            </label>

          ))}

          <div className="pt-2">
            <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
              <span className="inline-flex items-center gap-2">
                {isSubmitting ? <Spinner /> : null}
                {isSubmitting ? 'Submitting...' : config.buttonLabel}
              </span>
            </Button>
          </div>
        </form>

      </Card>

      <div className="grid gap-4">
        <Card className="border-[var(--border)] bg-[var(--bg-secondary)] p-[18px]">
          <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Integration boundary</p>
          <p className="mt-2 text-[12px] leading-[1.6] text-[var(--text-secondary)]">
            Buy initiates customer funding, verifies status, and delivers BTN from the distribution account. Sell pays out fiat and returns BTN automatically from the delegated customer wallet. Transfer either moves BTN directly to another customer wallet or falls back to fiat payout plus BTN return to distribution.
          </p>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--bg-secondary)] p-[18px]">
          <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
            {mode === 'buy'
              ? 'Latest payment status'
              : mode === 'sell'
                ? 'Latest sell status'
                : mode === 'transfer'
                  ? 'Latest transfer status'
                  : 'Latest submission preview'}
          </p>

          {(mode === 'buy' || mode === 'sell' || mode === 'transfer') && paymentDetails ? (
            <div className="mt-4 grid gap-3">
              {(mode === 'buy' ? buySummaryRows : mode === 'sell' ? sellSummaryRows : transferSummaryRows).map((row) => (
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-3" key={row.label}>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{row.label}</p>
                  <p className="mt-1 break-all text-[12px] leading-[1.6] text-[var(--text-secondary)]">{row.value || '-'}</p>
                </div>
              ))}
            </div>
          ) : lastSubmission ? (
            <div className="mt-4 grid gap-3">
              {Object.entries(lastSubmission).map(([key, value]) => (
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-3" key={key}>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{key}</p>
                  <p className="mt-1 text-[12px] leading-[1.6] text-[var(--text-secondary)]">{value || '-'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-[12px] leading-[1.6] text-[var(--text-secondary)]">
              {mode === 'buy'
                ? 'After submission, the generated payment reference and current gateway-tracked status will appear here when the gateway callback updates the backend.'
                : mode === 'sell'
                  ? 'After submission, the generated payout reference, payout status, and BTN return details will appear here.'
                  : mode === 'transfer'
                    ? 'After submission, the portal will show whether the backend completed a direct wallet transfer or switched to fiat fallback for the recipient.'
                    : 'Submitted customer actions will appear here so the flow can be reviewed before wiring to backend APIs.'}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

export default PortalActionPage;
