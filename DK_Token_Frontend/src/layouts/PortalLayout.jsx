import {
  ArrowsRightLeftIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  PowerIcon,
  WalletIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import Button from '../components/ui/Button';
import usePortalAuth from '../hooks/usePortalAuth';
import { portalApi } from '../modules/portal/portal.api';
import { cn } from '../utils/cn';
import { formatAmount } from '../utils/format';

const PORTAL_NAV_ITEMS = [
  { label: 'Overview', path: '/portal/overview', icon: BanknotesIcon },
  { label: 'Wallet', path: '/portal/wallet', icon: WalletIcon },
  { label: 'Buy BTN', path: '/portal/buy', icon: CurrencyDollarIcon },
  { label: 'Sell BTN', path: '/portal/sell', icon: ArrowsRightLeftIcon },
  { label: 'Transfer BTN', path: '/portal/transfer', icon: ArrowsRightLeftIcon },
];

function PortalLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { customer, logout, token } = usePortalAuth();
  const [summary, setSummary] = useState(null);
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
  }, [token, pathname, summaryReloadKey]);

  const btnBalance = summary?.customer?.btnBalance || customer?.btnBalance || '0';
  const primaryAccountNumber = summary?.customer?.primaryAccountNumber || customer?.primaryAccountNumber || customer?.linkedBankAccountNumber;
  const availableFiatBalance = summary?.linkedAccount?.availableBalance != null
    ? `${summary.linkedAccount.currencyCode || 'BTN'} ${formatAmount(summary.linkedAccount.availableBalance)}`
    : 'Not available';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_18%),linear-gradient(180deg,_#07110f_0%,_#0b1220_45%,_#0f172a_100%)]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">BTN User Portal</p>
            <h1 className="mt-1 text-lg font-semibold text-white">
              {PORTAL_NAV_ITEMS.find((item) => item.path === pathname)?.label || 'Customer Journey'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-right sm:block">
              <p className="text-sm font-medium text-white">{customer?.fullName}</p>
              <p className="text-xs text-zinc-400">CID {customer?.cid}</p>
            </div>
            <Button
              onClick={async () => {
                await logout();
                navigate('/portal/login');
              }}
              size="sm"
              variant="secondary"
            >
              <PowerIcon className="size-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[260px_minmax(0,1fr)] md:px-8">
        <aside className="rounded-[1.5rem] border border-white/10 bg-zinc-950/60 p-4 backdrop-blur">
          <div className="mb-4 rounded-[1.25rem] border border-emerald-400/20 bg-emerald-400/10 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Portfolio</p>
            <div className="mt-3 grid gap-3">
              <div>
                <p className="text-xs text-zinc-400">Available BTN</p>
                <p className="text-2xl font-semibold text-white">{formatAmount(btnBalance)} BTN</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Available fiat</p>
                <p className="text-sm font-semibold text-white">{availableFiatBalance}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">DK account</p>
                <p className="font-mono text-sm text-zinc-200">{primaryAccountNumber || '-'}</p>
              </div>
            </div>
          </div>

          <nav className="grid gap-2">
            {PORTAL_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition',
                    isActive
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-white'
                      : 'border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/20 hover:bg-white/[0.05]',
                  )}
                  key={item.path}
                  to={item.path}
                >
                  <Icon className="size-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default PortalLayout;
