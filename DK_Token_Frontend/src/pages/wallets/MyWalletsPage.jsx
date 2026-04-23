import { Alert, Card, CardContent, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import useAuth from '../../hooks/useAuth';
import { walletsApi } from '../../modules/wallets/wallets.api';
import { truncateMiddle } from '../../utils/format';

function MyWalletsPage() {
  const { user, hydrateUser } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

        const ownedWallets = walletResponse.data.items || [];
        setWallets(ownedWallets);

        const balanceResponses = await Promise.all(
          ownedWallets.map(async (wallet) => {
            const response = await walletsApi.getTokenBalances(wallet.id);
            return {
              wallet,
              balances: response.data.balances || [],
            };
          }),
        );

        const nextRows = balanceResponses.flatMap(({ wallet, balances }) => {
          if (!balances.length) {
            return [{
              id: `${wallet.id}-empty`,
              walletLabel: wallet.label || 'Unlabelled wallet',
              walletAddress: wallet.walletAddress,
              mintAddress: '-',
              amount: '0',
              decimals: '-',
              tokenAccountAddress: '-',
            }];
          }

          return balances.map((balance) => ({
            id: `${wallet.id}-${balance.tokenAccountAddress}`,
            walletLabel: wallet.label || 'Unlabelled wallet',
            walletAddress: wallet.walletAddress,
            mintAddress: balance.mintAddress,
            amount: balance.amount,
            decimals: balance.decimals,
            tokenAccountAddress: balance.tokenAccountAddress,
          }));
        });

        setRows(nextRows);
        await hydrateUser().catch(() => null);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load your wallet balances.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user?.id]);

  const columns = useMemo(() => [
    {
      key: 'walletLabel',
      label: 'Wallet',
      render: (row) => (
        <Stack spacing={0.25}>
          <Typography sx={{ fontWeight: 700 }} variant="body2">{row.walletLabel}</Typography>
          <Typography color="text.secondary" variant="caption">
            {truncateMiddle(row.walletAddress, 12, 10)}
          </Typography>
        </Stack>
      ),
    },
    {
      key: 'mintAddress',
      label: 'Mint',
      render: (row) => (row.mintAddress === '-' ? '-' : truncateMiddle(row.mintAddress, 12, 10)),
    },
    {
      key: 'amount',
      label: 'Balance',
      align: 'right',
    },
    {
      key: 'decimals',
      label: 'Decimals',
      align: 'right',
    },
    {
      key: 'tokenAccountAddress',
      label: 'Token Account',
      render: (row) => (
        row.tokenAccountAddress === '-' ? '-' : truncateMiddle(row.tokenAccountAddress, 12, 10)
      ),
    },
  ], []);

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
                Balances come from the connected Solana RPC and reflect the current local-validator state.
              </Alert>
              <AppTable
                columns={columns}
                emptyDescription="No token balances were found for your wallets."
                emptyTitle="No token balances"
                pagination={null}
                rows={rows}
              />
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}

export default MyWalletsPage;
