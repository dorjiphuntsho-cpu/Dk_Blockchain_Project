import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, CardContent, MenuItem, Stack, Typography } from '@mui/material';
import { FormProvider, useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import FormTextField from '../../components/form/FormTextField';
import { managedTokensApi } from '../../modules/solana/managedTokens.api';
import WalletBalanceShowcase from '../../components/wallet/WalletBalanceShowcase';
import { usersApi } from '../../modules/users/users.api';
import { walletsApi } from '../../modules/wallets/wallets.api';
import { walletSchema } from '../../modules/wallets/wallets.schemas';
import { getErrorMessage } from '../../utils/error';

function WalletDetailsPage() {
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [walletRecord, setWalletRecord] = useState(null);
  const [balances, setBalances] = useState([]);
  const [tokenMetadataMap, setTokenMetadataMap] = useState({});
  const [balanceError, setBalanceError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const methods = useForm({
    defaultValues: {
      userId: '',
      walletAddress: '',
      label: '',
      isPrimary: false,
    },
    resolver: zodResolver(walletSchema),
  });

  async function loadWallet() {
    setLoading(true);
    setBalanceError('');

    try {
      const [walletResponse, usersResponse] = await Promise.all([
        walletsApi.getById(id),
        usersApi.list({ page: 1, limit: 100 }),
      ]);
      const managedTokenResponse = await managedTokensApi.list({ page: 1, limit: 200 });

      const wallet = walletResponse.data;
      setWalletRecord(wallet);
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
      methods.reset({
        userId: wallet.userId,
        walletAddress: wallet.walletAddress,
        label: wallet.label || '',
        isPrimary: wallet.isPrimary,
      });
      setUsers(usersResponse.data.items);

      try {
        const balancesResponse = await walletsApi.getTokenBalances(id);
        setBalances(balancesResponse.data.balances || []);
      } catch (loadError) {
        setBalances([]);
        setBalanceError(loadError.message || 'Unable to load token balances.');
      }
    } catch (loadError) {
      throw loadError;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWallet().catch((error) => {
      enqueueSnackbar(getErrorMessage(error, 'Unable to load wallet details.'), { variant: 'error' });
      setLoading(false);
    });
  }, [enqueueSnackbar, id]);

  const handleSubmit = methods.handleSubmit(async (values) => {
    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);
      await walletsApi.update(id, {
        ...values,
        isPrimary: values.isPrimary === true || values.isPrimary === 'true',
      });
      enqueueSnackbar('Wallet updated successfully', { variant: 'success' });
      loadWallet();
    } catch (updateError) {
      enqueueSnackbar(getErrorMessage(updateError, 'Unable to update wallet'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  });

  if (loading) {
    return <LoadingScreen message="Loading wallet details..." />;
  }

  return (
    <Stack spacing={3}>
      <PageHeader subtitle="Review wallet status and update wallet details." title="Wallet Details" />
      <Card>
        <CardContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Update wallet metadata, user assignment, and primary status.
          </Typography>
          <FormProvider {...methods}>
            <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
              <FormTextField label="User" name="userId" select>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>{user.fullName}</MenuItem>
                ))}
              </FormTextField>
              <FormTextField label="Wallet Address" name="walletAddress" />
              <FormTextField label="Label" name="label" />
              <FormTextField label="Is Primary" name="isPrimary" select>
                <MenuItem value={false}>No</MenuItem>
                <MenuItem value={true}>Yes</MenuItem>
              </FormTextField>
              <Stack direction="row" spacing={1.5}>
                <Button
                  color="warning"
                  disabled={submitting}
                  onClick={async () => {
                    try {
                      if (submitting) {
                        return;
                      }

                      setSubmitting(true);
                      await walletsApi.updateStatus(id, false);
                      enqueueSnackbar('Wallet deactivated', { variant: 'success' });
                      loadWallet();
                    } catch (deactivateError) {
                      enqueueSnackbar(getErrorMessage(deactivateError, 'Unable to deactivate wallet'), { variant: 'error' });
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  variant="outlined"
                >
                  {submitting ? 'Saving...' : 'Deactivate'}
                </Button>
                <Button disabled={submitting} type="submit" variant="contained">
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </Stack>
            </Stack>
          </FormProvider>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Token Balances</Typography>
            <Typography color="text.secondary">
              Live SPL token balances for this wallet from the connected Solana RPC.
            </Typography>
            {balanceError ? (
              <ErrorState
                actionLabel="Reload Balances"
                description={balanceError}
                onAction={() => loadWallet().catch(() => {})}
                title="Unable to load token balances"
              />
            ) : (
              <WalletBalanceShowcase
                balances={balances}
                emptyDescription="No SPL token balances were found for this wallet on the current Solana RPC."
                emptyTitle="No token balances"
                showWalletAddress
                tokenMetadataMap={tokenMetadataMap}
                walletAddress={walletRecord?.walletAddress || ''}
                walletLabel={walletRecord?.label || 'Wallet Holdings'}
              />
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

export default WalletDetailsPage;
