import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
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

  const loadWallet = useCallback(async () => {
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
    } finally {
      setLoading(false);
    }
  }, [id, methods]);

  useEffect(() => {
    (async () => {
      try {
        await loadWallet();
      } catch (error) {
        enqueueSnackbar(getErrorMessage(error, 'Unable to load wallet details.'), { variant: 'error' });
        setLoading(false);
      }
    })();
  }, [enqueueSnackbar, loadWallet]);

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
    <div className="space-y-6">
      <PageHeader subtitle="Review wallet status and update wallet details." title="Wallet Details" />
      <section className="max-w-3xl">
        <Card className="min-w-0 rounded-2xl bg-zinc-900/80">
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white">Wallet settings</h2>
              <p className="mt-1 text-sm text-zinc-400">Update wallet metadata, user assignment, and primary status.</p>
            </div>
          <FormProvider {...methods}>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <FormTextField label="User" name="userId" select>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.fullName}</option>
                ))}
              </FormTextField>
              <FormTextField label="Wallet Address" name="walletAddress" />
              <FormTextField label="Label" name="label" />
              <FormTextField label="Is Primary" name="isPrimary" select>
                <option value={false}>No</option>
                <option value={true}>Yes</option>
              </FormTextField>
              <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">
                <Button
                  className="w-full sm:w-auto"
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
                  variant="danger"
                >
                  {submitting ? 'Saving...' : 'Deactivate'}
                </Button>
                <Button className="w-full sm:w-auto" disabled={submitting} type="submit" variant="primary">
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </FormProvider>
          </div>
        </Card>
      </section>
      <Card className="min-w-0">
          <div className="space-y-4">
            <div>
            <h2 className="text-base font-semibold text-white">Token Balances</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Live SPL token balances for this wallet from the connected Solana RPC.
            </p>
            </div>
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
          </div>
      </Card>
    </div>
  );
}

export default WalletDetailsPage;
