import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, CardContent, MenuItem, Stack, Typography } from '@mui/material';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import PageHeader from '../../components/common/PageHeader';
import ErrorState from '../../components/common/ErrorState';
import FormAmountField from '../../components/form/FormAmountField';
import FormTextField from '../../components/form/FormTextField';
import { managedTokensApi } from '../../modules/solana/managedTokens.api';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { tokenRequestSchema } from '../../modules/tokenRequests/tokenRequests.schemas';
import { walletsApi } from '../../modules/wallets/wallets.api';
import { REQUEST_TYPES } from '../../utils/constants';
import { truncateMiddle } from '../../utils/format';

function TokenRequestCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const draftRequest = location.state?.request || null;
  const [wallets, setWallets] = useState([]);
  const [managedTokens, setManagedTokens] = useState([]);
  const [error, setError] = useState('');
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
    const payload = {
      ...values,
      sourceWalletId: values.sourceWalletId || null,
      destinationWalletId: values.destinationWalletId || null,
      amount: Number(values.amount),
    };

    const response = draftRequest
      ? await tokenRequestsApi.update(draftRequest.id, payload)
      : await tokenRequestsApi.create(payload);

    if (submitForApproval) {
      await tokenRequestsApi.submit(response.data.id);
      enqueueSnackbar('Token request submitted successfully', { variant: 'success' });
    } else {
      enqueueSnackbar('Draft saved successfully', { variant: 'success' });
    }

    navigate(`/token-requests/${response.data.id}`);
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        subtitle="Capture the request details and choose whether to keep a draft or submit it."
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
                <Button onClick={() => methods.reset()} variant="outlined">Reset</Button>
                <Button type="submit" variant="outlined">Save Draft</Button>
                <Button onClick={methods.handleSubmit((values) => save(values, true))} variant="contained">
                  Submit for Approval
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
