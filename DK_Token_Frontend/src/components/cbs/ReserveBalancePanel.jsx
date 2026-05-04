import Card from '../ui/Card';
import { formatAmount } from '../../utils/format';

function ReserveBalancePanel({
  data,
  error = '',
  loading = false,
  title = 'DK Reserve Balance',
  subtitle = 'Live CBS balance for the DK Bank issuer reserve account.',
}) {
  const inquiry = data?.inquiry || null;
  const reserveAccount = data?.reserveAccount || null;
  const bank = data?.bank || null;
  const restrictionSummary = inquiry?.restrictionSummary || null;
  const balanceLabel = inquiry?.availableBalance != null
    ? `${inquiry.currencyCode || reserveAccount?.currency || 'BTN'} ${formatAmount(inquiry.availableBalance)}`
    : 'Not available';

  return (
    <Card className="rounded-[1.5rem] border-white/10 bg-zinc-950/70">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">{title}</p>
          <p className="mt-2 text-sm leading-7 text-zinc-400">{subtitle}</p>
        </div>

        {error ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Issuer bank</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {loading ? 'Loading...' : bank ? `${bank.name} (${bank.code})` : 'Not available'}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Reserve account</p>
            <p className="mt-3 font-mono text-sm text-white">
              {loading ? 'Loading...' : reserveAccount?.accountNumber || 'Not available'}
            </p>
            {reserveAccount?.accountName ? (
              <p className="mt-2 text-sm text-zinc-400">{reserveAccount.accountName}</p>
            ) : null}
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Available balance</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? 'Loading...' : balanceLabel}</p>
          </div>
        </div>

        {restrictionSummary ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Can debit</p>
              <p className="mt-1 text-sm font-semibold text-white">{restrictionSummary.canDebit ? 'Yes' : 'No'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Can credit</p>
              <p className="mt-1 text-sm font-semibold text-white">{restrictionSummary.canCredit ? 'Yes' : 'No'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Transactions blocked</p>
              <p className="mt-1 text-sm font-semibold text-white">{restrictionSummary.transactionsBlocked ? 'Yes' : 'No'}</p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default ReserveBalancePanel;
