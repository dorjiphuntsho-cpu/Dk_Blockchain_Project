import { ArrowTrendingUpIcon, BanknotesIcon, BoltIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import usePortalAuth from '../../hooks/usePortalAuth';
import { portalApi } from '../../modules/portal/portal.api';
import { getErrorMessage } from '../../utils/error';
import { formatAmount, truncateMiddle } from '../../utils/format';

const ACTION_CARDS = [
  {
    title: 'Buy BTN',
    description: 'Fund your DK account and begin the request to purchase BTN into your wallet balance.',
    path: '/portal/buy',
    icon: BanknotesIcon,
  },
  {
    title: 'Sell BTN',
    description: 'Create a sell instruction for BTN and capture your preferred payout account details.',
    path: '/portal/sell',
    icon: ArrowTrendingUpIcon,
  },
  {
    title: 'Transfer BTN',
    description: 'Move BTN to another beneficiary without entering the internal token operations dashboard.',
    path: '/portal/transfer',
    icon: BoltIcon,
  },
];

function PortalHomePage() {
  const { customer, token } = usePortalAuth();
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);

  useEffect(() => {
    const handleSummaryRefresh = () => {
      setSummaryReloadKey((current) => current + 1);
    };

    window.addEventListener('portal-summary-refresh', handleSummaryRefresh);

    return () => {
      window.removeEventListener('portal-summary-refresh', handleSummaryRefresh);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async () => {
      setIsSummaryLoading(true);
      setSummaryError('');

      try {
        const response = await portalApi.getSummary(token);

        if (!isMounted) {
          return;
        }

        setSummary(response.data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSummaryError(getErrorMessage(error, 'Unable to load BTN token summary'));
      } finally {
        if (isMounted) {
          setIsSummaryLoading(false);
        }
      }
    };

    if (token) {
      loadSummary();
    } else {
      setIsSummaryLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [token, summaryReloadKey]);

  const tokenSummary = summary?.token;
  const linkedBank = summary?.linkedBank;
  const linkedAccount = summary?.linkedAccount;
  const linkedBankAccounts = summary?.linkedBankAccounts || summary?.customer?.linkedBankAccounts || [];
  const tokenName = tokenSummary?.name || 'BTN Token';
  const tokenSymbol = tokenSummary?.symbol || 'BTN';
  const walletAddress = summary?.customer?.primaryWalletAddress || customer?.wallets?.[0]?.walletAddress || 'Not linked'; // eslint-disable-line no-unused-vars
  const linkedBankAccountNumber = summary?.customer?.linkedBankAccountNumber || customer?.linkedBankAccountNumber || 'Not linked';
  const btnBalance = summary?.customer?.btnBalance != null
    ? `${formatAmount(summary.customer.btnBalance)} ${tokenSymbol}`
    : `0 ${tokenSymbol}`;
  const issuerBankLabel = linkedBank ? `${linkedBank.name} (${linkedBank.code})` : 'Not available';
  const availableBalance = linkedAccount?.availableBalance != null
    ? `${linkedAccount.currencyCode || 'BTN'} ${formatAmount(linkedAccount.availableBalance)}`
    : 'Not available';
  const availableDistribution = tokenSummary?.distributionInventory?.displayAmount != null
    ? `${formatAmount(tokenSummary.distributionInventory.displayAmount)} ${tokenSymbol}`
    : 'Not available';
  const totalSupply = tokenSummary?.totalSupplyDisplay
    ? `${formatAmount(tokenSummary.totalSupplyDisplay)} ${tokenSymbol}`
    : 'Not available';
  const referencePrice = tokenSummary?.referencePrice != null
    ? `${tokenSummary.referencePriceCurrency} ${formatAmount(tokenSummary.referencePrice)}`
    : 'Not available';

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden rounded-[1.75rem] border-emerald-400/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,23,42,0.9)_54%,rgba(14,165,233,0.16))] p-0">
        <div className="grid gap-8 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Customer overview</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
              Welcome back, {customer?.fullName}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-200/80">
              Use this portal to manage customer-facing BTN actions only. Buy, sell, and transfer flows are kept separate from the admin operations console.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
            <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-300">Available BTN</p>
              <p className="mt-3 text-2xl font-semibold text-white">{isSummaryLoading ? 'Loading...' : btnBalance}</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-300">Available fiat</p>
              <p className="mt-3 text-2xl font-semibold text-white">{isSummaryLoading ? 'Loading...' : availableBalance}</p>
              {linkedAccount?.accountName ? (
                <p className="mt-2 text-sm text-zinc-300">{linkedAccount.accountName}</p>
              ) : null}
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-300">Fiat account</p>
              <p className="mt-3 font-mono text-lg text-white">{linkedBankAccountNumber}</p>
              <p className="mt-2 text-sm text-zinc-300">{linkedBankAccounts.length} linked bank account{linkedBankAccounts.length === 1 ? '' : 's'}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-[1.75rem] border-white/10 bg-zinc-950/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">BTN market snapshot</p>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white">{tokenName}</h3>
            <p className="mt-2 text-sm leading-7 text-zinc-400">
              The portal shows the current managed token supply, the backend reference price, and the DK Bank issuer link behind BTN.
            </p>
          </div>

          {summaryError ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {summaryError}
            </div>
          ) : null}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Token</p>
            <p className="mt-3 text-2xl font-semibold text-white">{tokenSymbol}</p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Linked bank</p>
            <p className="mt-3 text-lg font-semibold text-white">{isSummaryLoading ? 'Loading...' : issuerBankLabel}</p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Available distribution</p>
            <p className="mt-3 text-2xl font-semibold text-white">{isSummaryLoading ? 'Loading...' : availableDistribution}</p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Reference price</p>
            <p className="mt-3 text-2xl font-semibold text-white">{isSummaryLoading ? 'Loading...' : referencePrice}</p>
          </div>
        </div>

        <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Total minted supply</p>
          <p className="mt-2 text-lg font-semibold text-white">{isSummaryLoading ? 'Loading...' : totalSupply}</p>
        </div>

        {linkedBank?.reserveAccountNumber ? (
          <div className="mt-4 rounded-[1.25rem] border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">DK Bank reserve linkage</p>
            <p className="mt-2 text-sm leading-7 text-zinc-200">
              BTN is linked to {linkedBank.name} as the issuer bank, with reserve account{' '}
              <span className="font-mono text-white">{linkedBank.reserveAccountNumber}</span>
              {linkedBank.reserveAccountName ? ` (${linkedBank.reserveAccountName})` : ''}.
            </p>
          </div>
        ) : null}

        {linkedAccount?.warning ? (
          <p className="mt-4 text-sm leading-7 text-amber-200/80">{linkedAccount.warning}</p>
        ) : null}

        {tokenSummary?.warning ? (
          <p className="mt-4 text-sm leading-7 text-amber-200/80">{tokenSummary.warning}</p>
        ) : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {ACTION_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Card className="rounded-[1.5rem] border-white/10 bg-zinc-950/70" key={card.path}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-300">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-white">{card.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-400">{card.description}</p>
                </div>
              </div>
              <div className="mt-6">
                <Button as={Link} className="w-full" to={card.path} variant="secondary">
                  Open {card.title}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-[1.75rem] border-white/10 bg-zinc-950/70">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Recent activity</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">Payment history</h3>
          </div>
        </div>

        {summary?.recentPayments?.length ? (
          <div className="mt-6 grid gap-3">
            {summary.recentPayments.map((payment) => (
              <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4" key={payment.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{truncateMiddle(payment.paymentReference, 14, 10)}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {payment.status} {payment.fulfillmentStatus ? `• ${payment.fulfillmentStatus}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {payment.currency || 'BTN'} {formatAmount(payment.amount)}
                  </p>
                </div>
                <p className="mt-3 text-sm text-zinc-400">{payment.statusMessage || '-'}</p>
                {payment.fulfillmentError ? (
                  <p className="mt-2 text-sm text-amber-200/80">{payment.fulfillmentError}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm leading-7 text-zinc-400">No payment history is available for this customer yet.</p>
        )}
      </Card>
    </div>
  );
}

export default PortalHomePage;
