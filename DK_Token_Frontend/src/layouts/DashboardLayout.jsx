import { Dialog, DialogBackdrop, DialogPanel, Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import {
  Bars3Icon,
  ChartBarSquareIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  PlayCircleIcon,
  QueueListIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  UsersIcon,
  WalletIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import useAppStore from '../app/store';
import SidebarItem from '../components/common/SidebarItem';
import UserWalletMatchChip from '../components/wallet/UserWalletMatchChip';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import useAuth from '../hooks/useAuth';
import useSolanaWallet from '../hooks/useSolanaWallet';
import { NAV_ITEMS, ROUTE_TITLES } from '../utils/constants';
import { cn } from '../utils/cn';
import { getInitials, truncateMiddle } from '../utils/format';
import { hasRole } from '../utils/permissions';

const DRAWER_WIDTH = 244;
const COLLAPSED_DRAWER_WIDTH = 76;
const NAV_ICONS = {
  dashboard: <ChartBarSquareIcon className="size-4" />,
  request: <DocumentDuplicateIcon className="size-4" />,
  myRequests: <ClipboardDocumentListIcon className="size-4" />,
  approvals: <ShieldCheckIcon className="size-4" />,
  execution: <PlayCircleIcon className="size-4" />,
  solana: <RectangleStackIcon className="size-4" />,
  users: <UsersIcon className="size-4" />,
  wallets: <WalletIcon className="size-4" />,
  logs: <QueueListIcon className="size-4" />,
};

function getTitle(pathname) {
  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname];
  }

  if (pathname.startsWith('/users/')) {
    return 'User Details';
  }

  if (pathname.startsWith('/wallets/')) {
    return 'Wallet Details';
  }

  if (pathname.startsWith('/token-requests/')) {
    return 'Token Request Details';
  }

  return 'Admin Portal';
}

function getSection(pathname) {
  const match = NAV_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
  return match?.section || 'Overview';
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event) => setIsDesktop(event.matches);
    setIsDesktop(media.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return isDesktop;
}

function DashboardLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { user, logout, hydrateUser } = useAuth();
  const { address, available, connect, connected, connecting, walletName } = useSolanaWallet();
  const { sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen, toggleSidebar } = useAppStore();
  const currentDrawerWidth = isDesktop ? (sidebarCollapsed ? COLLAPSED_DRAWER_WIDTH : DRAWER_WIDTH) : DRAWER_WIDTH;

  useEffect(() => {
    if (user?.id) {
      hydrateUser().catch(() => null);
    }
  }, [hydrateUser, user?.id]);

  const navigationItems = useMemo(
    () => NAV_ITEMS.filter((item) => hasRole(user, item.roles)),
    [user],
  );
  const navigationGroups = useMemo(
    () => navigationItems.reduce((groups, item) => {
      const section = item.section || 'General';
      groups[section] = groups[section] || [];
      groups[section].push(item);
      return groups;
    }, {}),
    [navigationItems],
  );
  const currentTitle = getTitle(pathname);
  const currentSection = getSection(pathname);

  const drawerContent = (
    <div className="flex h-full flex-col">
      <div className={cn('border-b border-white/10 px-3 py-3', sidebarCollapsed && isDesktop ? 'flex justify-center' : '')}>
        <div className={cn('flex items-center gap-3', (!sidebarCollapsed || !isDesktop) ? 'justify-start' : 'justify-center')}>
          <div className="flex size-8 items-center justify-center rounded-md border border-white/10 bg-zinc-900 text-zinc-300">
            <RectangleStackIcon className="size-4" />
          </div>
          {!sidebarCollapsed || !isDesktop ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">Token Admin Portal</p>
              <p className="text-xs text-zinc-500">Operations console</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {Object.entries(navigationGroups).map(([section, items]) => (
          <div className="mb-4" key={section}>
            {!sidebarCollapsed || !isDesktop ? (
              <p className="mb-1.5 px-2 text-xs text-zinc-500">{section}</p>
            ) : null}
            <div className="grid gap-1">
              {items.map((item) => (
                <SidebarItem
                  collapsed={sidebarCollapsed && isDesktop}
                  icon={NAV_ICONS[item.icon]}
                  key={item.path}
                  label={item.label}
                  onClick={() => setMobileSidebarOpen(false)}
                  path={item.path}
                  selected={pathname === item.path || pathname.startsWith(`${item.path}/`)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-4">
        {!sidebarCollapsed || !isDesktop ? (
          <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge tone="emerald">{user?.roles?.[0] || 'USER'}</Badge>
            </div>
            <p className="text-sm font-medium text-white">{user?.fullName}</p>
            <p className="mt-0.5 text-xs text-zinc-500">Console access active</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <Badge tone="emerald">{user?.roles?.[0] || 'USER'}</Badge>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="app-shell flex min-h-screen">
      {isDesktop ? (
        <aside
          className="sticky top-0 hidden h-screen border-r border-white/10 bg-zinc-950/90 lg:block"
          style={{ width: currentDrawerWidth }}
        >
          {drawerContent}
        </aside>
      ) : (
        <Transition appear as={Fragment} show={mobileSidebarOpen}>
          <Dialog as="div" className="relative z-50 lg:hidden" onClose={() => setMobileSidebarOpen(false)}>
            <DialogBackdrop className="fixed inset-0 bg-black/60 transition duration-100 ease-out data-[closed]:opacity-0" />
            <div className="fixed inset-0 flex">
              <DialogPanel className="flex h-full w-[244px] flex-col border-r border-white/10 bg-zinc-950 transition duration-100 ease-out data-[closed]:-translate-x-full">
                <div className="flex items-center justify-end px-3 py-3">
                  <button
                    className="rounded-md p-2 text-zinc-500 transition hover:bg-zinc-900/10 hover:text-zinc-200"
                    onClick={() => setMobileSidebarOpen(false)}
                    type="button"
                  >
                    <XMarkIcon className="size-5" />
                  </button>
                </div>
                {drawerContent}
              </DialogPanel>
            </div>
          </Dialog>
        </Transition>
      )}

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/85 backdrop-blur">
          <div className="flex min-h-[60px] items-center gap-3 px-4 md:px-6 xl:px-8">
            <button
              className="rounded-md border border-white/10 bg-zinc-900 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              onClick={isDesktop ? toggleSidebar : () => setMobileSidebarOpen(true)}
              type="button"
            >
              <Bars3Icon className="size-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-zinc-400">
                {currentSection} / {currentTitle}
              </p>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <Badge tone="emerald">{user?.roles?.[0] || 'USER'}</Badge>
              <UserWalletMatchChip />
              {!connected ? (
                <Button disabled={!available || connecting} onClick={connect} size="sm" variant="secondary">
                  {connecting ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              ) : (
                <Badge tone="blue">{`${walletName || 'Wallet'}: ${truncateMiddle(address, 8, 6)}`}</Badge>
              )}
              <Menu as="div" className="relative">
                <MenuButton className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-white/10 transition hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-white/20">
                  <span className="flex size-6 items-center justify-center rounded-md bg-zinc-700 text-[11px] font-medium text-white">
                    {getInitials(user?.fullName)}
                  </span>
                  <ChevronDownIcon className="size-4 text-zinc-400" />
                </MenuButton>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <MenuItems anchor="bottom end" className="z-50 mt-2 w-56 origin-top-right rounded-xl border border-white/10 bg-zinc-900/95 p-1 text-sm text-zinc-200 shadow-xl backdrop-blur transition duration-100 ease-out focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0">
                    <div className="border-b border-white/10 px-3 py-2">
                      <p className="text-sm font-medium text-white">{user?.fullName}</p>
                      <p className="mt-1 text-xs text-zinc-500">{user?.email}</p>
                    </div>
                    <MenuItem>
                      {({ focus }) => (
                        <button
                          className={cn('group mt-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-zinc-300', focus ? 'bg-zinc-900/10 text-white' : '')}
                          onClick={async () => {
                            await logout();
                            navigate('/login');
                          }}
                          type="button"
                        >
                          Logout
                          <ChevronRightIcon className="size-4 text-zinc-500 group-data-[focus]:text-zinc-300" />
                        </button>
                      )}
                    </MenuItem>
                  </MenuItems>
                </Transition>
              </Menu>
            </div>
          </div>
        </header>

        <main className="w-full max-w-full overflow-x-hidden px-4 py-4 md:px-6 md:py-5 xl:px-8 xl:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
