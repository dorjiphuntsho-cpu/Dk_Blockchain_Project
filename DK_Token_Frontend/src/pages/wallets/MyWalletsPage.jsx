import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  EyeIcon,
} from '@heroicons/react/16/solid';
import { useEffect, useMemo, useState } from 'react';

import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import WalletBalanceShowcase from '../../components/wallet/WalletBalanceShowcase';
import useAuth from '../../hooks/useAuth';
import { managedTokensApi } from '../../modules/solana/managedTokens.api';
import { walletsApi } from '../../modules/wallets/wallets.api';

function WalletActionsMenu({ walletAddress }) {
  const copyAddress = async () => {
    await navigator.clipboard.writeText(walletAddress);
  };

  return (
    <Menu as="div" className="relative inline-block text-right">
      <MenuButton className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white data-hover:bg-gray-700 data-open:bg-gray-700">
        Options
        <ChevronDownIcon className="size-4 fill-white/60" />
      </MenuButton>

      <MenuItems
        transition
        anchor="bottom end"
        className="w-52 origin-top-right rounded-xl border border-white/5 bg-white/5 p-1 text-sm/6 text-white transition duration-100 ease-out [--anchor-gap:--spacing(1)] focus:outline-none data-closed:scale-95 data-closed:opacity-0"
      >
        <MenuItem>
          <button
            type="button"
            className="group flex w-full items-center gap-2 rounded-lg px-3 py-1.5 data-focus:bg-white/10"
          >
            <EyeIcon className="size-4 fill-white/30" />
            View balances
          </button>
        </MenuItem>

        <MenuItem>
          <button
            type="button"
            onClick={copyAddress}
            className="group flex w-full items-center gap-2 rounded-lg px-3 py-1.5 data-focus:bg-white/10"
          >
            <ClipboardDocumentIcon className="size-4 fill-white/30" />
            Copy address
          </button>
        </MenuItem>

        <div className="my-1 h-px bg-white/5" />

        <MenuItem>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="group flex w-full items-center gap-2 rounded-lg px-3 py-1.5 data-focus:bg-white/10"
          >
            <ArrowPathIcon className="size-4 fill-white/30" />
            Refresh
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}

function MyWalletsPage() {
  const { user, hydrateUser } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [walletBalanceGroups, setWalletBalanceGroups] = useState([]);
  const [tokenMetadataMap, setTokenMetadataMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const summary = useMemo(
    () => ({
      activeWallets: wallets.length,
      walletsWithBalances: walletBalanceGroups.filter(({ balances }) => balances.length).length,
      holdings: walletBalanceGroups.reduce((count, { balances }) => count + balances.length, 0),
    }),
    [walletBalanceGroups, wallets.length],
  );

  useEffect(() => {
    async function load() {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError('');

        const walletResponse = await walletsApi.list({
          page: 1,
          limit: 100,
          userId: user.id,
          isActive: true,
        });

        const managedTokenResponse = await managedTokensApi.list({
          page: 1,
          limit: 200,
        });

        const ownedWallets = walletResponse.data.items || [];
        setWallets(ownedWallets);

        setTokenMetadataMap(
          Object.fromEntries(
            (managedTokenResponse.data.items || []).map((token) => [
              token.mintAddress,
              {
                name: token.name || token.onChain?.metadata?.name || null,
                symbol: token.symbol || token.onChain?.metadata?.symbol || null,
              },
            ]),
          ),
        );

        const balanceResponses = await Promise.all(
          ownedWallets.map(async (wallet) => {
            const response = await walletsApi.getTokenBalances(wallet.id);

            return {
              wallet,
              balances: response.data.balances || [],
            };
          }),
        );

        setWalletBalanceGroups(balanceResponses);
        await hydrateUser().catch(() => null);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load your wallet balances.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user?.id, hydrateUser]);

  if (loading) {
    return <LoadingScreen message="Loading your wallets..." />;
  }

  if (error) {
    return <ErrorState description={error} onAction={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="See the SPL token balances currently held by wallet records linked to your account."
        title="My Wallets"
      />

      {!wallets.length ? (
        <ErrorState
          actionLabel={null}
          description="No active wallet records are assigned to your account yet."
          title="No wallets linked"
        />
      ) : null}

      {wallets.length ? (
        <section className="rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
          <div className="space-y-6">
            <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-sm text-zinc-300">
              Balances come from the connected Solana RPC and reflect the current network state for
              your linked wallets.
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/10">
                {summary.activeWallets} active wallets
              </span>
              <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-white/10">
                {summary.walletsWithBalances} funded wallets
              </span>
              <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-white/10">
                {summary.holdings} token holdings
              </span>
            </div>

            <div className="space-y-4">
              {walletBalanceGroups.map(({ wallet, balances }) => (
                <div
                  key={wallet.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-white">
                        {wallet.label || 'Unlabelled wallet'}
                      </h2>
                      <p className="mt-1 truncate font-mono text-xs text-zinc-400">
                        {wallet.walletAddress}
                      </p>
                    </div>

                    <WalletActionsMenu walletAddress={wallet.walletAddress} />
                  </div>

                  <WalletBalanceShowcase
                    balances={balances}
                    emptyDescription="No SPL token balances were found for this wallet on the current Solana RPC."
                    emptyTitle="No token balances"
                    showWalletAddress={false}
                    tokenMetadataMap={tokenMetadataMap}
                    walletAddress={wallet.walletAddress}
                    walletLabel={wallet.label || 'Unlabelled wallet'}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default MyWalletsPage;