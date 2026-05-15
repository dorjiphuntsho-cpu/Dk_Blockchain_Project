import {
  ArrowsRightLeftIcon,
  Bars3BottomLeftIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  BuildingLibraryIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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

const PORTAL_NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', path: '/portal/overview', icon: BanknotesIcon },
      { label: 'Bank Accounts', path: '/portal/bank-accounts', icon: BuildingLibraryIcon },
      { label: 'Wallet', path: '/portal/wallet', icon: WalletIcon },
    ],
  },
  {
    label: 'Actions',
    items: [
      { label: 'Buy BTN', path: '/portal/buy', icon: CurrencyDollarIcon },
      { label: 'Sell BTN', path: '/portal/sell', icon: ArrowsRightLeftIcon },
      { label: 'Transfer BTN', path: '/portal/transfer', icon: ArrowsRightLeftIcon },
    ],
  },
];

function PortalLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { customer, logout, token } = usePortalAuth();
  const [summary, setSummary] = useState(null);
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('portal-sidebar-collapsed') === '1');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  useEffect(() => {
    window.localStorage.setItem('portal-sidebar-collapsed', sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  const btnBalance = summary?.customer?.btnBalance || customer?.btnBalance || '0';
  const primaryAccountNumber = summary?.customer?.primaryAccountNumber || customer?.primaryAccountNumber || customer?.linkedBankAccountNumber;
  const availableFiatBalance = summary?.linkedAccount?.availableBalance != null
    ? `${summary.linkedAccount.currencyCode || 'BTN'} ${formatAmount(summary.linkedAccount.availableBalance)}`
    : 'Not available';
  const currentPage = PORTAL_NAV_SECTIONS.flatMap((section) => section.items).find((item) => item.path === pathname);

  const navMarkup = (
    <div className="flex h-full flex-col gap-5">
      <div className="pt-2">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className={cn('min-w-0', sidebarCollapsed ? 'hidden md:block' : '')}>
          <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--accent-gold)]">BTN Portal</p>
          {!sidebarCollapsed ? <p className="mt-1 text-[11px] text-[var(--text-muted)]">Customer operations console</p> : null}
        </div>
        <button
          className="hidden rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] p-2 text-[var(--text-secondary)] transition duration-150 ease-out hover:bg-[var(--bg-tertiary)] hover:text-white md:block"
          onClick={() => setSidebarCollapsed((current) => !current)}
          type="button"
        >
          {sidebarCollapsed ? <ChevronRightIcon className="size-4" /> : <ChevronLeftIcon className="size-4" />}
        </button>
      </div>
      </div>

      <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Portfolio</p>
        <div className="mt-3 grid gap-3">
          <div>
            <p className="text-[11px] text-[var(--text-secondary)]">BTN balance</p>
            <p className="fintech-number text-xl text-[var(--accent-gold)]">{formatAmount(btnBalance)}</p>
          </div>
          {!sidebarCollapsed ? (
            <>
              <div>
                <p className="text-[11px] text-[var(--text-secondary)]">Fiat available</p>
                <p className="text-sm font-medium text-white">{availableFiatBalance}</p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-secondary)]">Settlement account</p>
                <p className="truncate font-mono text-xs text-[var(--text-primary)]">{primaryAccountNumber || '-'}</p>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <nav className="grid gap-4">
        {PORTAL_NAV_SECTIONS.map((section) => (
          <div className="grid gap-1.5" key={section.label}>
            {!sidebarCollapsed ? <p className="px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{section.label}</p> : null}
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  className={({ isActive }) => cn(
                    'group relative flex h-10 items-center gap-3 rounded-[8px] border border-transparent px-3 text-sm transition duration-150 ease-out',
                    sidebarCollapsed ? 'justify-center px-2' : '',
                    isActive
                      ? 'bg-[var(--bg-tertiary)] text-white'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-white',
                  )}
                  key={item.path}
                  onClick={() => setMobileSidebarOpen(false)}
                  to={item.path}
                >
                  <span className={cn('absolute inset-y-1 left-0 w-0.5 rounded-r bg-[var(--accent-gold)] opacity-0 transition duration-150 ease-out', pathname === item.path ? 'opacity-100' : 'group-hover:opacity-60')} />
                  <Icon className="size-4 shrink-0" />
                  {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B0E11]">
      <div className="flex min-h-screen">
        <aside className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--border)] bg-[var(--bg-primary)] px-3 py-4 md:block',
          sidebarCollapsed ? 'w-[88px]' : 'w-[220px]',
        )}>
          {navMarkup}
        </aside>

        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm md:hidden">
            <div className="h-full w-[220px] border-r border-[var(--border)] bg-[var(--bg-primary)] p-4">
              {navMarkup}
            </div>
          </div>
        ) : null}

        <div className={cn('min-w-0 flex-1', sidebarCollapsed ? 'md:ml-[88px]' : 'md:ml-[220px]')}>
          <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-primary)]">
            <div className="flex h-12 items-center justify-between gap-3 px-4 md:px-6">
              <div className="flex items-center gap-3">
                <button
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] p-2 text-[var(--text-secondary)] md:hidden"
                  onClick={() => setMobileSidebarOpen(true)}
                  type="button"
                >
                  <Bars3BottomLeftIcon className="size-4" />
                </button>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">Customer Portal</p>
                  <h1 className="text-base font-semibold text-white">{currentPage?.label || 'Overview'}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                <div className="hidden rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 lg:block">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">Available BTN</p>
                  <p className="fintech-number text-sm text-[var(--accent-gold)]">{formatAmount(btnBalance)} BTN</p>
                </div>
                <div className="hidden rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 sm:block">
                  <p className="text-sm font-medium text-white">{customer?.fullName}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">CID {customer?.cid}</p>
                </div>
                <Button
                  onClick={async () => {
                    await logout();
                    navigate('/portal/login');
                  }}
                  size="sm"
                  variant="outline"
                >
                  <PowerIcon className="size-4" />
                  Logout
                </Button>
              </div>
            </div>
          </header>

          <main className="bg-[var(--bg-primary)] p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default PortalLayout;
