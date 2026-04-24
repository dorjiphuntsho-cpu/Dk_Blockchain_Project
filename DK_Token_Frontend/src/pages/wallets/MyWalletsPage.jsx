import { Alert, Card, CardContent, Chip, Stack } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import WalletBalanceShowcase from '../../components/wallet/WalletBalanceShowcase';
import useAuth from '../../hooks/useAuth';
import { managedTokensApi } from '../../modules/solana/managedTokens.api';
import { walletsApi } from '../../modules/wallets/wallets.api';

function MyWalletsPage() {
  const { user, hydrateUser } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [walletBalanceGroups, setWalletBalanceGroups] = useState([]);
  const [tokenMetadataMap, setTokenMetadataMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const summary = useMemo(() => ({
    activeWallets: wallets.length,
    walletsWithBalances: walletBalanceGroups.filter(({ balances }) => balances.length).length,
    holdings: walletBalanceGroups.reduce((count, { balances }) => count + balances.length, 0),
  }), [walletBalanceGroups, wallets.length]);

  useEffect(() => {
    async function load() {
      if (!user?.id) {
        return;
      }

      try {
        setLoading(true);
        setError('');

        const walletResponse = await walletsApi.list({
          page: 1,
          limit: 100,
          userId: user.id,
          isActive: true,
        });
        const managedTokenResponse = await managedTokensApi.list({ page: 1, limit: 200 });

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
  }, [user?.id]);

  if (loading) {
    return <LoadingScreen message="Loading your wallets..." />;
  }

  if (error) {
    return <ErrorState description={error} onAction={() => window.location.reload()} />;
  }

  return (
    <Stack spacing={3}>
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
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Alert severity="info">
                Balances come from the connected Solana RPC and reflect the current network state for your linked wallets.
              </Alert>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Chip label={`${summary.activeWallets} active wallets`} size="small" />
                <Chip label={`${summary.walletsWithBalances} funded wallets`} size="small" variant="outlined" />
                <Chip label={`${summary.holdings} token holdings`} size="small" variant="outlined" />
              </Stack>
              <Stack spacing={3}>
                {walletBalanceGroups.map(({ wallet, balances }) => (
                  <WalletBalanceShowcase
                    key={wallet.id}
                    balances={balances}
                    emptyDescription="No SPL token balances were found for this wallet on the current Solana RPC."
                    emptyTitle="No token balances"
                    showWalletAddress
                    tokenMetadataMap={tokenMetadataMap}
                    walletAddress={wallet.walletAddress}
                    walletLabel={wallet.label || 'Unlabelled wallet'}
                  />
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}

export default MyWalletsPage;
