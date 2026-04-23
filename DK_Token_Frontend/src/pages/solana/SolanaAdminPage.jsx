import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';

import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import { solanaAdminApi } from '../../modules/solana/solana.api';
import {
  buildAdminMintCreationTransaction,
  buildExplorerTransactionUrl,
  signAndSendWalletTransaction,
} from '../../modules/solana/walletExecution';
import { truncateMiddle } from '../../utils/format';

function DetailRow({ label, value }) {
  return (
    <Stack spacing={0.5}>
      <Typography color="text.secondary" variant="body2">{label}</Typography>
      <Typography sx={{ wordBreak: 'break-all' }}>{value || '-'}</Typography>
    </Stack>
  );
}

function SolanaAdminPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { address: connectedWalletAddress, connected: walletConnected, provider: walletProvider, connect } = useSolanaWallet();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkerAddress, setCheckerAddress] = useState('');
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [mintDecimals, setMintDecimals] = useState('0');
  const [mintName, setMintName] = useState('');
  const [mintSymbol, setMintSymbol] = useState('');
  const [mintUri, setMintUri] = useState('');
  const [latestMint, setLatestMint] = useState(null);
  const [submitting, setSubmitting] = useState({
    createMint: false,
    addChecker: false,
    setAdmin: false,
    removingChecker: '',
  });

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await solanaAdminApi.getConfigStatus();
      setStatus(response.data);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load Solana admin status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const checkerRows = useMemo(
    () =>
      (status?.onChain?.checkers || []).map((address) => ({
        id: address,
        address,
        isAdmin: status?.onChain?.admin === address,
        isConfiguredChecker: status?.configuredSigners?.checker === address,
      })),
    [status],
  );
  const adminWalletMismatch = Boolean(
    walletConnected
      && connectedWalletAddress
      && status?.configuredSigners?.admin
      && connectedWalletAddress !== status.configuredSigners.admin,
  );

  if (loading && !status) {
    return <LoadingScreen message="Loading Solana admin controls..." />;
  }

  if (error && !status) {
    return <ErrorState description={error} onAction={loadStatus} />;
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        subtitle="Inspect the on-chain config, manage checker addresses, and rotate the Solana admin signer for testing."
        title="Solana Admin"
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {(status?.warnings || []).map((warning) => (
        <Alert key={warning} severity="warning">{warning}</Alert>
      ))}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <Card>
            <CardContent>
              <Stack spacing={2.5}>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <Chip
                    color={status?.configExists ? 'success' : 'warning'}
                    label={status?.configExists ? 'Config Present' : 'Config Missing'}
                    size="small"
                  />
                  <Chip
                    color={status?.canManageOnChainConfig ? 'success' : 'warning'}
                    label={status?.canManageOnChainConfig ? 'Admin Signer Ready' : 'Admin Signer Mismatch'}
                    size="small"
                  />
                  <Chip
                    color={status?.checkerSignerConfiguredOnChain ? 'success' : 'warning'}
                    label={status?.checkerSignerConfiguredOnChain ? 'Checker Registered' : 'Checker Missing'}
                    size="small"
                  />
                </Stack>
                {walletConnected ? (
                  <Alert severity={adminWalletMismatch ? 'warning' : 'success'}>
                    {adminWalletMismatch
                      ? `Connected wallet ${connectedWalletAddress} does not match the configured admin signer ${status?.configuredSigners?.admin}.`
                      : `Connected admin wallet: ${connectedWalletAddress}`}
                  </Alert>
                ) : (
                  <Alert severity="info">
                    Connect the admin Phantom wallet before creating a managed token mint in the browser.
                  </Alert>
                )}

                <Typography variant="h6">Network Status</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <DetailRow label="RPC URL" value={status?.rpcUrl} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <DetailRow label="Commitment" value={status?.commitment} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <DetailRow label="Program ID" value={status?.programId} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <DetailRow label="Config Address" value={status?.configAddress} />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <DetailRow label="IDL Path" value={status?.idlPath} />
                  </Grid>
                </Grid>

                <Typography variant="h6">Signer Mapping</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <DetailRow label="Configured Admin Signer" value={status?.configuredSigners?.admin} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <DetailRow label="On-Chain Admin" value={status?.onChain?.admin} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <DetailRow label="Configured Maker Signer" value={status?.configuredSigners?.maker} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <DetailRow label="Configured Checker Signer" value={status?.configuredSigners?.checker} />
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, xl: 5 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Create Managed Token Mint</Typography>
                  <Alert severity="info">
                    The new mint will be owned by the program PDA, so approved mint requests can increase supply later.
                  </Alert>
                  {!walletConnected ? (
                    <Button onClick={connect} variant="outlined">
                      Connect Wallet
                    </Button>
                  ) : null}
                  <TextField
                    fullWidth
                    label="Token Name"
                    onChange={(event) => setMintName(event.target.value)}
                    value={mintName}
                  />
                  <TextField
                    fullWidth
                    label="Token Symbol"
                    onChange={(event) => setMintSymbol(event.target.value)}
                    value={mintSymbol}
                  />
                  <TextField
                    fullWidth
                    label="Metadata URI"
                    onChange={(event) => setMintUri(event.target.value)}
                    value={mintUri}
                  />
                  <TextField
                    fullWidth
                    inputProps={{ min: 0, max: 9 }}
                    label="Decimals"
                    onChange={(event) => setMintDecimals(event.target.value)}
                    type="number"
                    value={mintDecimals}
                  />
                  <Button
                    disabled={submitting.createMint || !mintName.trim() || !mintSymbol.trim() || !mintUri.trim() || !walletConnected || adminWalletMismatch}
                    onClick={async () => {
                      try {
                        setSubmitting((current) => ({ ...current, createMint: true }));
                        if (!walletProvider) {
                          throw new Error('Wallet provider is not available.');
                        }

                        const preparationResponse = await solanaAdminApi.prepareMintCreation();
                        const executionPayload = preparationResponse.data;
                        if (executionPayload.expectedAdminWalletAddress && executionPayload.expectedAdminWalletAddress !== connectedWalletAddress) {
                          throw new Error(`Connected wallet must match the configured admin wallet ${executionPayload.expectedAdminWalletAddress}.`);
                        }

                        const builtTransaction = await buildAdminMintCreationTransaction({
                          executionPayload,
                          adminWalletAddress: connectedWalletAddress,
                          decimals: Number(mintDecimals || 0),
                        });

                        const txSignature = await signAndSendWalletTransaction({
                          connection: builtTransaction.connection,
                          provider: walletProvider,
                          transaction: builtTransaction.transaction,
                          partialSigners: [builtTransaction.mintKeypair],
                        });

                        const recordResponse = await solanaAdminApi.recordCreatedTokenMint({
                          decimals: Number(mintDecimals || 0),
                          name: mintName.trim(),
                          symbol: mintSymbol.trim(),
                          metadataUri: mintUri.trim(),
                          mintAddress: builtTransaction.mintAddress,
                          tokenAuthority: executionPayload.tokenAuthority,
                          txSignature,
                          explorerUrl: buildExplorerTransactionUrl(txSignature, executionPayload.rpcUrl),
                          adminWalletAddress: connectedWalletAddress,
                          mintAuthority: executionPayload.tokenAuthority,
                          freezeAuthority: executionPayload.tokenAuthority,
                        });
                        setLatestMint(recordResponse.data);
                        setMintName('');
                        setMintSymbol('');
                        setMintUri('');
                        enqueueSnackbar('Managed token mint created', { variant: 'success' });
                      } catch (actionError) {
                        enqueueSnackbar(actionError.message || 'Unable to create token mint', { variant: 'error' });
                      } finally {
                        setSubmitting((current) => ({ ...current, createMint: false }));
                      }
                    }}
                    variant="contained"
                  >
                    Create Token Mint With Wallet
                  </Button>
                  {latestMint ? (
                    <Stack spacing={1}>
                      <Typography color="text.secondary" variant="body2">Latest Created Mint</Typography>
                      <Alert severity="success">
                        {latestMint.name} ({latestMint.symbol}) - {latestMint.mintAddress}
                      </Alert>
                      <Typography color="text.secondary" variant="body2">
                        Use this address in the token request form. Current supply is {latestMint.supply} and decimals are {latestMint.decimals}.
                      </Typography>
                      {latestMint.metadataUri ? (
                        <Typography color="text.secondary" variant="body2">
                          Metadata URI: {latestMint.metadataUri}
                        </Typography>
                      ) : null}
                    </Stack>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Add Checker</Typography>
                  <TextField
                    fullWidth
                    label="Checker Address"
                    onChange={(event) => setCheckerAddress(event.target.value)}
                    value={checkerAddress}
                  />
                  <Button
                    disabled={!checkerAddress || submitting.addChecker}
                    onClick={async () => {
                      try {
                        setSubmitting((current) => ({ ...current, addChecker: true }));
                        const response = await solanaAdminApi.addChecker(checkerAddress.trim());
                        setStatus(response.data);
                        setCheckerAddress('');
                        enqueueSnackbar('Checker added on chain', { variant: 'success' });
                      } catch (actionError) {
                        enqueueSnackbar(actionError.message || 'Unable to add checker', { variant: 'error' });
                      } finally {
                        setSubmitting((current) => ({ ...current, addChecker: false }));
                      }
                    }}
                    variant="contained"
                  >
                    Add Checker
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Rotate Admin</Typography>
                  <Alert severity="info">
                    If you change the on-chain admin away from the configured backend admin signer, update backend env before the next restart.
                  </Alert>
                  <TextField
                    fullWidth
                    label="New Admin Address"
                    onChange={(event) => setNewAdminAddress(event.target.value)}
                    value={newAdminAddress}
                  />
                  <Button
                    color="warning"
                    disabled={!newAdminAddress || submitting.setAdmin}
                    onClick={async () => {
                      try {
                        setSubmitting((current) => ({ ...current, setAdmin: true }));
                        const response = await solanaAdminApi.setAdmin(newAdminAddress.trim());
                        setStatus(response.data);
                        setNewAdminAddress('');
                        enqueueSnackbar('On-chain admin updated', { variant: 'success' });
                      } catch (actionError) {
                        enqueueSnackbar(actionError.message || 'Unable to rotate admin', { variant: 'error' });
                      } finally {
                        setSubmitting((current) => ({ ...current, setAdmin: false }));
                      }
                    }}
                    variant="contained"
                  >
                    Set Admin
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">On-Chain Checkers</Typography>
            <AppTable
              columns={[
                {
                  key: 'address',
                  label: 'Address',
                  render: (row) => (
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Typography>{truncateMiddle(row.address, 12, 10)}</Typography>
                      {row.isAdmin ? <Chip label="Admin" size="small" color="warning" /> : null}
                      {row.isConfiguredChecker ? <Chip label="Backend Checker" size="small" color="success" /> : null}
                    </Stack>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  align: 'right',
                  disableRowClick: true,
                  render: (row) => (
                    <Button
                      color="error"
                      disabled={row.isAdmin || submitting.removingChecker === row.address}
                      onClick={async () => {
                        try {
                          setSubmitting((current) => ({ ...current, removingChecker: row.address }));
                          const response = await solanaAdminApi.removeChecker(row.address);
                          setStatus(response.data);
                          enqueueSnackbar('Checker removed on chain', { variant: 'success' });
                        } catch (actionError) {
                          enqueueSnackbar(actionError.message || 'Unable to remove checker', { variant: 'error' });
                        } finally {
                          setSubmitting((current) => ({ ...current, removingChecker: '' }));
                        }
                      }}
                      size="small"
                      variant="outlined"
                    >
                      Remove
                    </Button>
                  ),
                },
              ]}
              emptyDescription="No checker addresses are registered on chain."
              emptyTitle="No checkers"
              pagination={null}
              rows={checkerRows}
            />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

export default SolanaAdminPage;

