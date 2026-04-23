import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, CardContent, MenuItem, Stack, Typography } from '@mui/material';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import useSolanaWallet from '../../hooks/useSolanaWallet';

import PageHeader from '../../components/common/PageHeader';
import ErrorState from '../../components/common/ErrorState';
import FormAmountField from '../../components/form/FormAmountField';
import FormTextField from '../../components/form/FormTextField';
import { managedTokensApi } from '../../modules/solana/managedTokens.api';
import { buildExplorerTransactionUrl, buildMakerInitiationTransaction, signAndSendMakerTransaction } from '../../modules/solana/walletExecution';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { tokenRequestSchema } from '../../modules/tokenRequests/tokenRequests.schemas';
import { walletsApi } from '../../modules/wallets/wallets.api';
import { REQUEST_TYPES } from '../../utils/constants';
import { getErrorMessage } from '../../utils/error';
import { truncateMiddle } from '../../utils/format';

function TokenRequestCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const {
    address: connectedWalletAddress,
    connect: connectWallet,
    available: walletAvailable,
    connected: walletConnected,
    provider: walletProvider,
  } = useSolanaWallet();
  const draftRequest = location.state?.request || null;
  const [wallets, setWallets] = useState([]);
  const [managedTokens, setManagedTokens] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  useEffect(() => {
    async function loadFormOptions() {
      try {
        setError('');
        const [walletResponse, tokenResponse] = await Promise.all([
          walletsApi.list({ page: 1, limit: 100, isActive: true }),
          managedTokensApi.list({ page: 1, limit: 100 }),
        ]);

        setWallets(walletResponse.data.items);
        setManagedTokens(tokenResponse.data.items);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load wallets and managed tokens.');
      }
    }

    loadFormOptions();
  }, []);

  const fieldVisibility = useMemo(() => ({
    source: requestType === REQUEST_TYPES.TRANSFER || requestType === REQUEST_TYPES.BURN,
    destination: requestType === REQUEST_TYPES.MINT || requestType === REQUEST_TYPES.TRANSFER,
  }), [requestType]);

  const tokenOptions = useMemo(() => {
    const options = [...managedTokens];

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
  }, [draftRequest?.decimals, draftRequest?.tokenMintAddress, managedTokens]);

  useEffect(() => {
    if (!fieldVisibility.source) {
      methods.setValue('sourceWalletId', '');
    }

    if (!fieldVisibility.destination) {
      methods.setValue('destinationWalletId', '');
    }
  }, [fieldVisibility.destination, fieldVisibility.source, methods]);

  async function save(values, submitForApproval = false) {
    if (isSubmitting) {
      return;
    }

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

        await tokenRequestsApi.recordInitiation(requestId, initiationPayload);

        enqueueSnackbar('Token request created and signed with wallet', { variant: 'success' });
      } else {
        enqueueSnackbar('Draft saved successfully', { variant: 'success' });
      }

      navigate(`/token-requests/${savedRequestId}`);
    } catch (saveError) {
      const errorMessage = getErrorMessage(saveError, 'Unable to save token request');

      if (submitForApproval && savedRequestId) {
        enqueueSnackbar(
          `Request was saved, but wallet submission did not complete: ${errorMessage}`,
          { variant: 'warning' },
        );
        navigate(`/token-requests/${savedRequestId}`);
        return;
      }

      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        subtitle="Capture the request details, then submit with the maker wallet so the checker can finalize it on chain."
        title={draftRequest ? 'Edit Draft Request' : 'Create Token Request'}
      />
      {error ? <ErrorState description={error} onAction={() => window.location.reload()} /> : null}
      <Card>
        <CardContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            The form changes automatically for MINT, TRANSFER, and BURN workflows.
          </Typography>
          <FormProvider {...methods}>
            <Stack component="form" onSubmit={methods.handleSubmit((values) => save(values))} spacing={2.5}>
              <FormTextField label="Request Type" name="requestType" select>
                <MenuItem value={REQUEST_TYPES.MINT}>MINT</MenuItem>
                <MenuItem value={REQUEST_TYPES.TRANSFER}>TRANSFER</MenuItem>
                <MenuItem value={REQUEST_TYPES.BURN}>BURN</MenuItem>
              </FormTextField>
              <FormTextField
                label="Managed Token"
                name="tokenMintAddress"
                select
                disabled={!tokenOptions.length}
                helperText={tokenOptions.length
                  ? 'Select from token mints already created in the portal.'
                  : 'Create a managed token first before creating a request.'}
              >
                {tokenOptions.map((token) => (
                  <MenuItem key={token.id || token.mintAddress} value={token.mintAddress}>
                    {token.name || token.onChain?.metadata?.name || truncateMiddle(token.mintAddress, 12, 10)}
                    {(token.symbol || token.onChain?.metadata?.symbol) ? ` • ${token.symbol || token.onChain?.metadata?.symbol}` : ''}
                    {typeof token.decimals === 'number' ? ` • ${token.decimals} decimals` : ''}
                  </MenuItem>
                ))}
              </FormTextField>
              <FormAmountField label="Amount" name="amount" />
              {fieldVisibility.source ? (
                <FormTextField label="Source Wallet" name="sourceWalletId" select>
                  {wallets.map((wallet) => (
                    <MenuItem key={wallet.id} value={wallet.id}>
                      {wallet.label || wallet.walletAddress}
                    </MenuItem>
                  ))}
                </FormTextField>
              ) : null}
              {fieldVisibility.destination ? (
                <FormTextField label="Destination Wallet" name="destinationWalletId" select>
                  {wallets.map((wallet) => (
                    <MenuItem key={wallet.id} value={wallet.id}>
                      {wallet.label || wallet.walletAddress}
                    </MenuItem>
                  ))}
                </FormTextField>
              ) : null}
              <FormTextField label="Remarks" multiline minRows={3} name="remarks" />
              <Stack direction="row" spacing={1.5}>
                <Button disabled={isSubmitting} onClick={() => methods.reset()} variant="outlined">Reset</Button>
                <Button disabled={isSubmitting} type="submit" variant="outlined">Save Draft</Button>
                <Button
                  disabled={isSubmitting}
                  onClick={methods.handleSubmit((values) => save(values, true))}
                  type="button"
                  variant="contained"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit & Sign With Wallet'}
                </Button>
              </Stack>
            </Stack>
          </FormProvider>
        </CardContent>
      </Card>
    </Stack>
  );
}

export default TokenRequestCreatePage;
