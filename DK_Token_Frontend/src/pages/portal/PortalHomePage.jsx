import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BoltIcon,
  CheckBadgeIcon,
  DocumentDuplicateIcon,
  WalletIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import usePortalAuth from '../../hooks/usePortalAuth';
import { portalApi } from '../../modules/portal/portal.api';
import { cn } from '../../utils/cn';
import { getErrorMessage } from '../../utils/error';
import { formatAmount, truncateMiddle } from '../../utils/format';

const ACTION_CARDS = [
  { title: 'Buy BTN', description: 'Fund DK and request BTN issuance.', path: '/portal/buy', icon: BanknotesIcon },
  { title: 'Sell BTN', description: 'Create fiat payout against BTN holdings.', path: '/portal/sell', icon: ArrowTrendingUpIcon },
  { title: 'Transfer BTN', description: 'Send BTN to another beneficiary.', path: '/portal/transfer', icon: BoltIcon },
];

function splitDisplayValue(value) {
  const parts = String(value || '').split(' ');
  if (parts.length < 2) return { main: String(value || ''), unit: '' };
  return { main: parts.slice(0, -1).join(' '), unit: parts.at(-1) };
}

function PortalHomePage() {
  const { customer, token } = usePortalAuth();
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);

  useEffect(() => {
    const handleSummaryRefresh = () => setSummaryReloadKey((current) => current + 1);
    window.addEventListener('portal-summary-refresh', handleSummaryRefresh);
    return () => window.removeEventListener('portal-summary-refresh', handleSummaryRefresh);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadSummary = async () => {
      setIsSummaryLoading(true);
      setSummaryError('');
      try {
        const response = await portalApi.getSummary(token);
        if (isMounted) setSummary(response.data);
      } catch (error) {
        if (isMounted) setSummaryError(getErrorMessage(error, 'Unable to load BTN token summary'));
      } finally {
        if (isMounted) setIsSummaryLoading(false);
      }
    };
    if (token) loadSummary(); else setIsSummaryLoading(false);
    return () => { isMounted = false; };
  }, [token, summaryReloadKey]);

  const tokenSummary = summary?.token;
  const linkedBank = summary?.linkedBank;
  const linkedAccount = summary?.linkedAccount;
  const linkedBankAccounts = summary?.linkedBankAccounts || summary?.customer?.linkedBankAccounts || [];
  const tokenName = tokenSummary?.name || 'BTN Token';
  const tokenSymbol = tokenSummary?.symbol || 'BTN';
  const walletAddress = summary?.customer?.primaryWalletAddress || customer?.wallets?.[0]?.walletAddress || 'Not linked';
  const linkedBankAccountNumber = summary?.customer?.linkedBankAccountNumber || customer?.linkedBankAccountNumber || 'Not linked';
  const btnBalance = summary?.customer?.btnBalance != null ? `${formatAmount(summary.customer.btnBalance)} ${tokenSymbol}` : `0 ${tokenSymbol}`;
  const issuerBankLabel = linkedBank ? `${linkedBank.name} (${linkedBank.code})` : 'Not available';
  const availableBalance = linkedAccount?.availableBalance != null ? `${linkedAccount.currencyCode || 'BTN'} ${formatAmount(linkedAccount.availableBalance)}` : 'Not available';
  const availableDistribution = tokenSummary?.distributionInventory?.displayAmount != null ? `${formatAmount(tokenSummary.distributionInventory.displayAmount)} ${tokenSymbol}` : 'Not available';
  const totalSupply = tokenSummary?.totalSupplyDisplay ? `${formatAmount(tokenSummary.totalSupplyDisplay)} ${tokenSymbol}` : 'Not available';
  const referencePrice = tokenSummary?.referencePrice != null ? `${tokenSummary.referencePriceCurrency} ${formatAmount(tokenSummary.referencePrice)}` : 'Not available';
  const activityItems = summary?.recentPayments || [];
  const statCards = [
    { label: 'BTN Balance', value: btnBalance, tone: 'text-[var(--text-primary)]' },
    { label: 'Fiat Balance', value: availableBalance, tone: 'text-[var(--text-primary)]' },
    { label: 'Reference Price', value: referencePrice, tone: 'text-[var(--accent-gold)]' },
    { label: 'Distribution', value: availableDistribution, tone: 'text-[var(--text-primary)]' },
  ];
  const handleCopyWallet = async () => {
    if (!walletAddress || walletAddress === 'Not linked' || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(walletAddress);
  };

  return (
    <div className="grid gap-2.5">
      <Card className="border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="grid gap-2.5 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="grid gap-4">
            <div className="flex min-h-[80px] items-center justify-between gap-3 px-6 py-4">
              <div className="min-w-0">
                <p className="fintech-section-title text-[var(--accent-gold)]">Overview</p>
                <div className="mt-1 flex items-center gap-2">
                  <h2 className="text-[22px] font-semibold text-white">Welcome back, {customer?.fullName}</h2>
                  <div className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--bg-tertiary)] px-[10px] py-[3px] text-[11px] font-medium text-[var(--success)]">
                    <CheckBadgeIcon className="size-3.5" />
                    Verified account
                  </div>
                </div>
                <p className="mt-1 truncate text-[12px] text-[var(--text-secondary)]">Live customer balance, funding status, token coverage, and recent transfer flow.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {statCards.map((item) => (
                <div className="group flex min-h-[76px] flex-col justify-between rounded-[8px] border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-[14px] transition duration-200 ease-out hover:border-[var(--accent-gold)] hover:[box-shadow:inset_2px_0_0_0_var(--accent-gold)]" key={item.label}>
                  <p className="fintech-label">{item.label}</p>
                  {isSummaryLoading ? (
                    <span className="fintech-skeleton block h-6 w-28" />
                  ) : (
                    <p className={cn('fintech-value flex flex-wrap items-baseline', item.tone)}>
                      {(() => {
                        const { main, unit } = splitDisplayValue(item.value);
                        const compactValue = main.length > 12;
                        return (
                          <>
                            <span className={cn(compactValue && 'fintech-value-sm')}>{main}</span>
                            {unit ? <span className="fintech-unit shrink-0">{unit}</span> : null}
                          </>
                        );
                      })()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-2.5">
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="fintech-section-title">Wallet Summary</p>
                  <div className="group mt-2 flex items-center gap-2">
                    <p className="min-w-0 truncate font-mono text-sm text-[var(--text-primary)]">{walletAddress === 'Not linked' ? walletAddress : truncateMiddle(walletAddress, 12, 10)}</p>
                    {walletAddress !== 'Not linked' ? (
                      <button className="opacity-0 transition duration-150 ease-out group-hover:opacity-100" onClick={handleCopyWallet} type="button">
                        <DocumentDuplicateIcon className="size-4 text-[var(--text-secondary)] hover:text-white" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[var(--success)]" />
                  <WalletIcon className="size-5 text-[var(--accent-gold)]" />
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
                  <span className="text-[var(--text-secondary)]">Linked bank accounts</span>
                  <span className="fintech-number text-sm text-[var(--text-primary)]">{linkedBankAccounts.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Primary fiat account</span>
                  <span className="font-mono text-xs text-[var(--text-primary)]">{linkedBankAccountNumber}</span>
                </div>
              </div>
            </div>
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
              <div className="flex items-center justify-between gap-3"><p className="mb-2 fintech-section-title">Operational Status</p><ArrowPathIcon className="size-4 text-[var(--text-secondary)] transition duration-150 ease-out hover:rotate-180 hover:text-white" /></div>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex items-center justify-between border-t border-[var(--border)] pt-3"><span className="text-[var(--text-secondary)]">Issuer Bank</span><span className="text-right text-[var(--text-primary)]">{isSummaryLoading ? 'Loading...' : issuerBankLabel}</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--text-secondary)]">Total Supply</span><span className="fintech-number text-sm text-[var(--text-primary)]">{isSummaryLoading ? 'Loading...' : totalSupply}</span></div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-2.5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between gap-3">
            <div><p className="mb-2 fintech-section-title">Market Snapshot</p><h3 className="text-lg font-semibold text-white">{tokenName}</h3></div>
            {summaryError ? <div className="rounded-[8px] border border-[var(--danger)]/20 bg-[var(--danger)]/10 px-3 py-2 text-xs text-rose-200">{summaryError}</div> : null}
          </div>
          <div className="mt-[10px] overflow-hidden rounded-[8px] border border-[var(--border)]">
            <div className="grid grid-cols-2 bg-[var(--bg-tertiary)] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)] xl:grid-cols-4">
              <span>Token</span><span>Reference</span><span>Distribution</span><span>Reserve Link</span>
            </div>
            <div className="grid grid-cols-2 items-center bg-[var(--bg-secondary)] px-4 py-3 text-sm transition duration-150 ease-out hover:bg-[rgba(240,185,11,0.04)] xl:grid-cols-4">
              <span className="fintech-number text-[var(--text-primary)]">{tokenSymbol}</span>
              <span className="fintech-number text-[var(--accent-gold)]">{isSummaryLoading ? 'Loading...' : referencePrice}</span>
              <span className="fintech-number text-[var(--text-primary)]">{isSummaryLoading ? 'Loading...' : availableDistribution}</span>
              <span className="font-mono text-xs text-[var(--text-primary)]">{linkedBank?.reserveAccountNumber || '-'}</span>
            </div>
          </div>
          {(linkedAccount?.warning || tokenSummary?.warning) ? <div className="mt-4 rounded-[8px] border border-[var(--accent-gold-dim)]/20 bg-[var(--accent-gold)]/10 px-3 py-2 text-sm text-amber-100">{linkedAccount?.warning || tokenSummary?.warning}</div> : null}
        </Card>
        <Card className="border-[var(--border)] bg-[var(--bg-secondary)]">
          <p className="mb-2 fintech-section-title">Quick Actions</p>
          <div className="mt-[10px] overflow-hidden rounded-[8px] border border-[var(--border)]">
            {ACTION_CARDS.map((card) => {
              const Icon = card.icon;
              const iconTone = card.title === 'Buy BTN' ? 'text-[var(--accent-gold)] bg-[var(--accent-gold)]/10' : card.title === 'Sell BTN' ? 'text-[var(--success)] bg-[var(--success)]/10' : 'text-sky-400 bg-sky-400/10';
              return (
                <div className="flex h-[52px] items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] px-4 last:border-b-0" key={card.path}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn('rounded-[6px] p-2', iconTone)}><Icon className="size-4" /></div>
                    <div className="min-w-0"><p className="text-sm font-semibold text-white">{card.title}</p><p className="truncate text-xs text-[var(--text-secondary)]">{card.description}</p></div>
                  </div>
                  <Button as={Link} className="h-auto rounded-[4px] px-3 py-1 text-[11px] font-semibold" size="sm" to={card.path} variant="primary">Open</Button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between gap-3">
            <div><p className="mb-2 fintech-section-title">Recent Activity</p><h3 className="text-lg font-semibold text-white">Payments and transfer events</h3></div>
            <p className="text-xs text-[var(--text-secondary)]">{activityItems.length} records</p>
          </div>
          {activityItems.length ? (
            <div className="mt-[10px] overflow-hidden rounded-[8px] border border-[var(--border)]">
              <div className="grid grid-cols-[1.6fr_0.7fr_0.8fr] bg-[var(--bg-tertiary)] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]"><span>Reference</span><span>Status</span><span className="text-right">Amount</span></div>
              <div className="divide-y divide-[var(--border)]">
                {activityItems.map((payment) => (
                  <div className="grid grid-cols-[1.6fr_0.7fr_0.8fr] items-center px-4 py-3 text-sm transition duration-150 ease-out hover:bg-[rgba(240,185,11,0.04)]" key={payment.id}>
                    <div className="min-w-0"><p className="truncate font-medium text-white">{truncateMiddle(payment.paymentReference, 14, 10)}</p><p className="truncate text-xs text-[var(--text-secondary)]">{payment.statusMessage || '-'}</p></div>
                    <span className="inline-flex w-fit rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]">{payment.status}</span>
                    <p className="fintech-number text-right text-sm text-white">{payment.currency || 'BTN'} {formatAmount(payment.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="mt-4 rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">No payment history is available for this customer yet.</div>}
        </Card>
        <Card className="border-[var(--border)] bg-[var(--bg-secondary)]">
          <p className="mb-2 fintech-section-title">Account Controls</p>
          <div className="mt-[10px] grid gap-3">
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-secondary)] p-4"><p className="text-sm font-semibold text-white">Verification Status</p><p className="mt-1 text-sm text-[var(--text-secondary)]">Customer profile, wallet link, and bank account mapping are active.</p></div>
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-secondary)] p-4"><p className="text-sm font-semibold text-white">Reserve Backing</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{linkedBank?.reserveAccountName || linkedBank?.name || 'Issuer bank'} reserve account is linked for managed BTN issuance.</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default PortalHomePage;
