import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import useAuth from '../../hooks/useAuth';

import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/common/PageHeader';
import ErrorState from '../../components/common/ErrorState';
import FormAmountField from '../../components/form/FormAmountField';
import FormTextField from '../../components/form/FormTextField';
import { managedTokensApi } from '../../modules/solana/managedTokens.api';
import { buildExplorerTransactionUrl, buildMakerInitiationTransaction, signAndSendMakerTransaction } from '../../modules/solana/walletExecution';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { clearPendingInitiationRecovery, savePendingInitiationRecovery } from '../../modules/tokenRequests/tokenRequestRecovery';
import { tokenRequestSchema } from '../../modules/tokenRequests/tokenRequests.schemas';
import { walletsApi } from '../../modules/wallets/wallets.api';
import { REQUEST_TYPES, ROLES } from '../../utils/constants';
import { getErrorMessage } from '../../utils/error';
import { truncateMiddle } from '../../utils/format';

function TokenRequestCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const {
    address: connectedWalletAddress,
    connect: connectWallet,
    available: walletAvailable,
    connected: walletConnected,
    provider: walletProvider,
  } = useSolanaWallet();
  const draftRequest = location.state?.request || null;
  const [makerWallets, setMakerWallets] = useState([]);
  const [managedTokens, setManagedTokens] = useState([]);
  const [sourceWalletBalances, setSourceWalletBalances] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const methods = useForm({
    defaultValues: {
      requestType: draftRequest?.requestType || REQUEST_TYPES.MINT,
      tokenMintAddress: draftRequest?.tokenMintAddress || '',
      amount: draftRequest ? Number(draftRequest.amount) : '',
      sourceWalletId: draftRequest?.sourceWalletId || '',
      destinationWalletId: draftRequest?.destinationWalletId || '',
      remarks: draftRequest?.remarks || '',
    },
    resolver: zodResolver(tokenRequestSchema),
  });
  const requestType = useWatch({ control: methods.control, name: 'requestType' });

  const ownActiveWallets = useMemo(
    () => (user?.wallets || []).filter((wallet) => wallet.isActive),
    [user?.wallets],
  );

  const isMakerWallet = (wallet) => wallet?.isActive && wallet.user?.roles?.includes(ROLES.MAKER);

  const selectedSourceWallet = useMemo(() => {
    if (!ownActiveWallets.length) {
      return null;
    }

    if (draftRequest?.sourceWalletId) {
      const draftWallet = ownActiveWallets.find((wallet) => wallet.id === draftRequest.sourceWalletId);
      if (draftWallet) {
        return draftWallet;
      }
    }

    if (connectedWalletAddress) {
      const connectedWallet = ownActiveWallets.find((wallet) => wallet.walletAddress === connectedWalletAddress);
      if (connectedWallet) {
        return connectedWallet;
      }
    }

    return ownActiveWallets.find((wallet) => wallet.isPrimary) || ownActiveWallets[0];
  }, [connectedWalletAddress, draftRequest?.sourceWalletId, ownActiveWallets]);

  useEffect(() => {
    async function loadFormOptions() {
      try {
        setError('');
        const [walletResponse, tokenResponse] = await Promise.all([
          walletsApi.list({ page: 1, limit: 100, isActive: true }),
          managedTokensApi.list({ page: 1, limit: 100 }),
        ]);

        setMakerWallets(walletResponse.data.items);
        setManagedTokens(tokenResponse.data.items);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load wallets and managed tokens.');
      }
    }

    loadFormOptions();
  }, []);

  useEffect(() => {
    async function loadSourceWalletBalances() {
      if (!selectedSourceWallet || ![REQUEST_TYPES.TRANSFER, REQUEST_TYPES.BURN].includes(requestType)) {
        setSourceWalletBalances([]);
        return;
      }

      try {
        const response = await walletsApi.getTokenBalances(selectedSourceWallet.id);
        setSourceWalletBalances(response.data?.balances || []);
      } catch (loadError) {
        setSourceWalletBalances([]);
        setError(loadError.message || 'Unable to load wallet token balances.');
      }
    }

    loadSourceWalletBalances();
  }, [requestType, selectedSourceWallet]);

  const fieldVisibility = useMemo(() => ({
    destination: requestType === REQUEST_TYPES.MINT || requestType === REQUEST_TYPES.TRANSFER,
  }), [requestType]);

  const availableManagedTokens = useMemo(() => {
    if (![REQUEST_TYPES.TRANSFER, REQUEST_TYPES.BURN].includes(requestType)) {
      return managedTokens;
    }

    const positiveBalanceMintAddresses = new Set(
      sourceWalletBalances
        .filter((balance) => Number(balance.rawAmount || balance.amount || 0) > 0)
        .map((balance) => balance.mintAddress),
    );

    return managedTokens.filter((token) => positiveBalanceMintAddresses.has(token.mintAddress));
  }, [managedTokens, requestType, sourceWalletBalances]);

  const destinationWalletOptions = useMemo(() => {
    const ownSourceWalletId = selectedSourceWallet?.id || null;

    return makerWallets.filter((wallet) => {
      if (!isMakerWallet(wallet)) {
        return false;
      }

      if (requestType === REQUEST_TYPES.TRANSFER && ownSourceWalletId && wallet.id === ownSourceWalletId) {
        return false;
      }

      return true;
    });
  }, [makerWallets, requestType, selectedSourceWallet?.id]);

  const tokenOptions = useMemo(() => {
    const options = [...availableManagedTokens];

    if (
      draftRequest?.tokenMintAddress
      && !options.some((token) => token.mintAddress === draftRequest.tokenMintAddress)
    ) {
      options.unshift({
        id: 'draft-token',
        mintAddress: draftRequest.tokenMintAddress,
        decimals: draftRequest.decimals ?? null,
      });
    }

    return options;
  }, [availableManagedTokens, draftRequest?.decimals, draftRequest?.tokenMintAddress]);

  useEffect(() => {
    if ([REQUEST_TYPES.TRANSFER, REQUEST_TYPES.BURN].includes(requestType)) {
      methods.setValue('sourceWalletId', selectedSourceWallet?.id || '');
    } else {
      methods.setValue('sourceWalletId', '');
    }

    if (!fieldVisibility.destination) {
      methods.setValue('destinationWalletId', '');
    }
  }, [fieldVisibility.destination, methods, requestType, selectedSourceWallet?.id]);

  useEffect(() => {
    const selectedTokenMintAddress = methods.getValues('tokenMintAddress');
    if (
      selectedTokenMintAddress
      && !tokenOptions.some((token) => token.mintAddress === selectedTokenMintAddress)
    ) {
      methods.setValue('tokenMintAddress', '');
    }

    const selectedDestinationWalletId = methods.getValues('destinationWalletId');
    if (
      selectedDestinationWalletId
      && !destinationWalletOptions.some((wallet) => wallet.id === selectedDestinationWalletId)
    ) {
      methods.setValue('destinationWalletId', '');
    }
  }, [destinationWalletOptions, methods, tokenOptions]);

  const sourceWalletDisplay = selectedSourceWallet
    ? selectedSourceWallet.label || truncateMiddle(selectedSourceWallet.walletAddress, 12, 10)
    : 'No active wallet linked to your account';
  const sourceWalletTokenCount = sourceWalletBalances
    .filter((balance) => Number(balance.rawAmount || balance.amount || 0) > 0)
    .length;

  async function save(values, submitForApproval = false) {
    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    let savedRequestId = null;

    try {
      const payload = {
        ...values,
        sourceWalletId: values.sourceWalletId || null,
        destinationWalletId: values.destinationWalletId || null,
        amount: Number(values.amount),
      };

      const response = draftRequest
        ? await tokenRequestsApi.update(draftRequest.id, payload)
        : await tokenRequestsApi.create(payload);
      savedRequestId = response.data.id;

      if (submitForApproval) {
        let makerWalletAddress = connectedWalletAddress;

        if (!walletConnected || !makerWalletAddress) {
          if (!walletAvailable || !connectWallet) {
            throw new Error('Connect the maker wallet before submitting this request.');
          }

          makerWalletAddress = await connectWallet();
        }

        if (!makerWalletAddress) {
          throw new Error('Connect the maker wallet before submitting this request.');
        }

        if (!walletProvider) {
          throw new Error('Wallet provider is not available.');
        }

        const requestId = response.data.id;
        const requestTypeToPrepare = response.data.requestType;
        const prepareResponse = requestTypeToPrepare === REQUEST_TYPES.MINT
          ? await tokenRequestsApi.prepareMintRequest(requestId)
          : requestTypeToPrepare === REQUEST_TYPES.TRANSFER
            ? await tokenRequestsApi.prepareTransferRequest(requestId)
            : await tokenRequestsApi.prepareBurnRequest(requestId);

        const executionPayload = prepareResponse.data;
        const builtTransaction = await buildMakerInitiationTransaction({
          executionPayload,
          makerWalletAddress,
        });

        const initiationSignature = await signAndSendMakerTransaction({
          connection: builtTransaction.connection,
          provider: walletProvider,
          requestKeypair: builtTransaction.requestKeypair,
          transaction: builtTransaction.transaction,
        });

        const initiationPayload = {
          makerWalletAddress,
          onChainRequestAddress: builtTransaction.requestAddress,
          initiationTxSignature: initiationSignature,
          initiationExplorerUrl: buildExplorerTransactionUrl(initiationSignature, executionPayload.rpcUrl),
        };

        if (builtTransaction.sourceTokenAccountAddress) {
          initiationPayload.sourceTokenAccountAddress = builtTransaction.sourceTokenAccountAddress;
        }

        if (builtTransaction.destinationTokenAccountAddress) {
          initiationPayload.destinationTokenAccountAddress = builtTransaction.destinationTokenAccountAddress;
        }

        savePendingInitiationRecovery(requestId, initiationPayload);
        await tokenRequestsApi.recordInitiation(requestId, initiationPayload);
        clearPendingInitiationRecovery(requestId);

        enqueueSnackbar('Token request created and signed with wallet', { variant: 'success' });
      } else {
        enqueueSnackbar('Draft saved successfully', { variant: 'success' });
      }

      navigate(`/token-requests/${savedRequestId}`);
    } catch (saveError) {
      const errorMessage = getErrorMessage(saveError, 'Unable to save token request');

      if (submitForApproval && savedRequestId) {
        enqueueSnackbar(
          `Request was saved. If wallet submission already reached the chain, the request page will finalize it automatically: ${errorMessage}`,
          { variant: 'warning' },
        );
        navigate(`/token-requests/${savedRequestId}`);
        return;
      }

      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Capture the request details, then submit with the maker wallet so the checker can finalize it on chain."
        title={draftRequest ? 'Edit Draft Request' : 'Create Token Request'}
      />
      {error ? <ErrorState description={error} onAction={() => window.location.reload()} /> : null}
      <section className="max-w-3xl">
        <Card className="rounded-2xl bg-zinc-900/80">
          <div className="space-y-6">
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-white">Request details</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  The form changes automatically for mint, transfer, and burn workflows and limits wallets and tokens to the current maker flow.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">{`Flow: ${requestType}`}</Badge>
              {[REQUEST_TYPES.TRANSFER, REQUEST_TYPES.BURN].includes(requestType) && selectedSourceWallet ? (
                <Badge tone="slate">{`Source: ${sourceWalletDisplay}`}</Badge>
              ) : null}
              {[REQUEST_TYPES.TRANSFER, REQUEST_TYPES.BURN].includes(requestType) && selectedSourceWallet ? (
                <Badge tone="slate">{`${sourceWalletTokenCount} token holdings`}</Badge>
              ) : null}
              </div>
            </div>
          {[REQUEST_TYPES.TRANSFER, REQUEST_TYPES.BURN].includes(requestType) && !selectedSourceWallet ? (
            <Alert tone="warning">
              Your account needs an active maker wallet before you can create transfer or burn requests.
            </Alert>
          ) : null}
          {[REQUEST_TYPES.TRANSFER, REQUEST_TYPES.BURN].includes(requestType) && selectedSourceWallet && connectedWalletAddress && connectedWalletAddress !== selectedSourceWallet.walletAddress ? (
            <Alert tone="info">
              Connect the wallet {selectedSourceWallet.walletAddress} before signing this request.
            </Alert>
          ) : null}
          <FormProvider {...methods}>
            <form className="space-y-6" onSubmit={methods.handleSubmit((values) => save(values))}>
              <FormTextField label="Request Type" name="requestType" select>
                <option value={REQUEST_TYPES.MINT}>MINT</option>
                <option value={REQUEST_TYPES.TRANSFER}>TRANSFER</option>
                <option value={REQUEST_TYPES.BURN}>BURN</option>
              </FormTextField>
              <FormTextField
                label="Managed Token"
                name="tokenMintAddress"
                select
                disabled={!tokenOptions.length}
                helperText={tokenOptions.length
                  ? [REQUEST_TYPES.TRANSFER, REQUEST_TYPES.BURN].includes(requestType)
                    ? 'Only tokens currently held in your source wallet are shown.'
                    : 'Select from token mints already created in the portal.'
                  : [REQUEST_TYPES.TRANSFER, REQUEST_TYPES.BURN].includes(requestType)
                    ? 'No managed tokens with balance were found in your source wallet.'
                  : 'Create a managed token first before creating a request.'}
              >
                {tokenOptions.map((token) => (
                  <option key={token.id || token.mintAddress} value={token.mintAddress}>
                    {token.name || token.onChain?.metadata?.name || truncateMiddle(token.mintAddress, 12, 10)}
                    {(token.symbol || token.onChain?.metadata?.symbol) ? ` - ${token.symbol || token.onChain?.metadata?.symbol}` : ''}
                    {typeof token.decimals === 'number' ? ` - ${token.decimals} decimals` : ''}
                  </option>
                ))}
              </FormTextField>
              {[REQUEST_TYPES.TRANSFER, REQUEST_TYPES.BURN].includes(requestType) && selectedSourceWallet && !tokenOptions.length ? (
                <Alert tone="info">
                  No transferable managed tokens were found in the selected source wallet. Mint tokens to this wallet first or use a wallet that already holds the token.
                </Alert>
              ) : null}
              <FormAmountField label="Amount" name="amount" />
              {[REQUEST_TYPES.TRANSFER, REQUEST_TYPES.BURN].includes(requestType) ? (
                <FormTextField
                  label="Source Wallet"
                  name="sourceWalletId"
                  helperText="Source wallet is fixed to your active maker wallet."
                  InputProps={{ readOnly: true }}
                  value={sourceWalletDisplay}
                />
              ) : null}
              {fieldVisibility.destination ? (
                <FormTextField
                  label="Destination Wallet"
                  name="destinationWalletId"
                  select
                  disabled={!destinationWalletOptions.length}
                  helperText="Only wallets belonging to maker users are available."
                >
                  {destinationWalletOptions.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.label || wallet.walletAddress}
                      {wallet.user?.fullName ? ` - ${wallet.user.fullName}` : ''}
                    </option>
                  ))}
                </FormTextField>
              ) : null}
              {fieldVisibility.destination && !destinationWalletOptions.length ? (
                <Alert tone="warning">
                  No eligible maker destination wallets are available right now. Check that destination users have active wallet records and the `MAKER` role.
                </Alert>
              ) : null}
              <FormTextField label="Remarks" multiline minRows={3} name="remarks" />
              <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
                <Button disabled={isSubmitting} onClick={() => methods.reset()} variant="secondary">Reset</Button>
                <Button disabled={isSubmitting} type="submit" variant="secondary">Save Draft</Button>
                <Button
                  disabled={isSubmitting}
                  onClick={methods.handleSubmit((values) => save(values, true))}
                  type="button"
                  variant="primary"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit & Sign With Wallet'}
                </Button>
              </div>
            </form>
          </FormProvider>
          </div>
        </Card>
      </section>
    </div>
  );
}

export default TokenRequestCreatePage;
