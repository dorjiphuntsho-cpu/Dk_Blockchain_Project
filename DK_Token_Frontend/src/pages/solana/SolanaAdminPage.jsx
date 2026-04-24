import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';

import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import { solanaAdminApi } from '../../modules/solana/solana.api';
import {
  buildAdminMintCreationTransaction,
  buildExplorerTransactionUrl,
  signAndSendWalletTransaction,
} from '../../modules/solana/walletExecution';
import { getErrorMessage } from '../../utils/error';
import { truncateMiddle } from '../../utils/format';

// ─── Atoms ────────────────────────────────────────────────────────────────────

function StatusDot({ ok }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        bgcolor: ok ? 'success.main' : 'warning.main',
        flexShrink: 0,
      }}
    />
  );
}

function AddressPill({ value }) {
  if (!value) return <Typography color="text.disabled" variant="body2">—</Typography>;
  return (
    <Typography
      component="span"
      sx={{
        fontFamily: 'monospace',
        fontSize: '0.78rem',
        letterSpacing: '0.02em',
        bgcolor: 'action.hover',
        px: 1,
        py: 0.4,
        borderRadius: 1.5,
        display: 'inline-block',
        wordBreak: 'break-all',
      }}
    >
      {value}
    </Typography>
  );
}

function StatCard({ label, value, mono = false, children }) {
  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        p: 2,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
      }}
    >
      <Typography
        sx={{
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'text.disabled',
        }}
      >
        {label}
      </Typography>
      {children ?? (
        mono
          ? <AddressPill value={value} />
          : <Typography sx={{ fontSize: '0.93rem', fontWeight: 600 }}>{value || '—'}</Typography>
      )}
    </Paper>
  );
}

function HealthRow({ ok, label, detail }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        py: 1.1,
        px: 1.5,
        borderRadius: 2,
        bgcolor: ok ? alpha('#22c55e', 0.06) : alpha('#f59e0b', 0.07),
      }}
    >
      <StatusDot ok={ok} />
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{label}</Typography>
        {detail && (
          <Typography variant="caption" color="text.secondary" noWrap>{detail}</Typography>
        )}
      </Stack>
      <Chip
        label={ok ? 'OK' : 'Review'}
        size="small"
        color={ok ? 'success' : 'warning'}
        sx={{ fontWeight: 700, fontSize: '0.66rem', height: 19 }}
      />
    </Stack>
  );
}

function FormGroup({ label, children }) {
  return (
    <Stack spacing={0.75}>
      <Typography
        sx={{
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

function SectionCard({ title, description, warningBorder = false, headerAction, children }) {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 4,
        border: '1px solid',
        borderColor: warningBorder ? alpha(theme.palette.warning.main, 0.35) : 'divider',
        bgcolor: warningBorder ? alpha(theme.palette.warning.main, 0.02) : 'background.paper',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: warningBorder ? alpha(theme.palette.warning.main, 0.2) : 'divider',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Stack spacing={0.25}>
          {title}
          {description && (
            <Typography variant="caption" color="text.secondary">{description}</Typography>
          )}
        </Stack>
        {headerAction}
      </Box>
      <Box sx={{ p: 3, flex: 1 }}>{children}</Box>
    </Paper>
  );
}

function TabPanel({ children, value, index }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }}>{children}</Box>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SolanaAdminPage() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const {
    address: connectedWalletAddress,
    connected: walletConnected,
    provider: walletProvider,
    connect,
  } = useSolanaWallet();

  const [activeTab, setActiveTab] = useState(0);
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

  useEffect(() => { loadStatus(); }, []);

  const checkerRows = useMemo(
    () => (status?.onChain?.checkers || []).map((address) => ({
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

  const canCreateMint =
    !submitting.createMint
    && mintName.trim()
    && mintSymbol.trim()
    && mintUri.trim()
    && walletConnected
    && !adminWalletMismatch;

  if (loading && !status) return <LoadingScreen message="Loading Solana admin controls…" />;
  if (error && !status) return <ErrorState description={error} onAction={loadStatus} />;

  // ── Shared handler: add checker ──────────────────────────────────────────
  const handleAddChecker = async () => {
    try {
      setSubmitting((c) => ({ ...c, addChecker: true }));
      const response = await solanaAdminApi.addChecker(checkerAddress.trim());
      setStatus(response.data);
      setCheckerAddress('');
      enqueueSnackbar('Checker added on chain', { variant: 'success' });
    } catch (actionError) {
      enqueueSnackbar(getErrorMessage(actionError, 'Unable to add checker'), { variant: 'error' });
    } finally {
      setSubmitting((c) => ({ ...c, addChecker: false }));
    }
  };

  return (
    <Stack spacing={3}>
      {/* ── Page title ──────────────────────────────────────────────────── */}
      <Stack spacing={0.4}>
        {/* <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'primary.main' }}>
          Protocol Control
        </Typography> */}
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
          Solana Admin
        </Typography>
        {/* <Typography color="text.secondary" variant="body2" sx={{ maxWidth: 540, mt: 0.25 }}>
          Inspect live config, manage checkers, rotate authority, and create managed token mints.
        </Typography> */}
      </Stack>

      {/* ── Persistent health + wallet banner ───────────────────────────── */}
      <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Grid container>
          <Grid
            size={{ xs: 12, md: 5 }}
            sx={{ p: { xs: 2, md: 2.5 }, borderRight: { md: '1px solid' }, borderBottom: { xs: '1px solid', md: 'none' }, borderColor: 'divider' }}
          >
            <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.disabled', mb: 1.25 }}>
              Environment health
            </Typography>
            <Stack spacing={0.75}>
              <HealthRow
                ok={status?.configExists}
                label="Config present"
                detail={status?.configAddress ? truncateMiddle(status.configAddress, 10, 8) : undefined}
              />
              <HealthRow
                ok={status?.canManageOnChainConfig}
                label="Admin signer aligned"
                detail={status?.configuredSigners?.admin ? truncateMiddle(status.configuredSigners.admin, 10, 8) : undefined}
              />
              <HealthRow
                ok={status?.checkerSignerConfiguredOnChain}
                label="Checker registered"
                detail={`${checkerRows.length} address${checkerRows.length !== 1 ? 'es' : ''} on chain`}
              />
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }} sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.disabled', mb: 1.25 }}>
              Wallet status
            </Typography>
            <Stack spacing={1}>
              {walletConnected ? (
                <Alert severity={adminWalletMismatch ? 'warning' : 'success'} sx={{ borderRadius: 2, py: 0.5 }}>
                  {adminWalletMismatch
                    ? `Wallet ${truncateMiddle(connectedWalletAddress, 8, 6)} doesn't match configured admin ${truncateMiddle(status?.configuredSigners?.admin || '', 8, 6)}.`
                    : `Connected: ${truncateMiddle(connectedWalletAddress || '', 10, 8)}`}
                </Alert>
              ) : (
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Alert severity="info" sx={{ borderRadius: 2, py: 0.5, flex: 1 }}>
                    Connect the admin Phantom wallet before running wallet-backed actions.
                  </Alert>
                  <Button onClick={connect} variant="outlined" size="small" sx={{ borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Connect
                  </Button>
                </Stack>
              )}
              {error && <Alert severity="error" sx={{ borderRadius: 2, py: 0.5 }}>{error}</Alert>}
              {(status?.warnings || []).map((w) => (
                <Alert key={w} severity="warning" sx={{ borderRadius: 2, py: 0.5 }}>{w}</Alert>
              ))}
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Box>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{
              '& .MuiTabs-indicator': { height: 2, borderRadius: '2px 2px 0 0' },
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                minHeight: 44,
                px: 2.5,
                color: 'text.secondary',
                '&.Mui-selected': { color: 'primary.main' },
              },
            }}
          >
            <Tab label="Overview" />
            <Tab
              label={
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <span>Checkers</span>
                  {checkerRows.length > 0 && (
                    <Box
                      sx={{
                        minWidth: 18,
                        height: 18,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        px: 0.5,
                      }}
                    >
                      {checkerRows.length}
                    </Box>
                  )}
                </Stack>
              }
            />
            <Tab label="Create Mint" />
            <Tab label="Authority" />
          </Tabs>
        </Box>

        {/* ─── Tab 0: Overview ──────────────────────────────────────────── */}
        <TabPanel value={activeTab} index={0}>
          <Stack spacing={3}>
            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.secondary', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Environment snapshot
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatCard label="RPC URL" value={status?.rpcUrl} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatCard label="Commitment" value={status?.commitment} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatCard label="Program ID" mono value={status?.programId} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatCard label="Config address" mono value={status?.configAddress} />
                </Grid>
                <Grid size={12}>
                  <StatCard label="IDL path" value={status?.idlPath} />
                </Grid>
              </Grid>
            </Stack>

            <Divider />

            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.secondary', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Authority mapping
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <StatCard label="Configured admin signer">
                    <AddressPill value={status?.configuredSigners?.admin} />
                  </StatCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <StatCard label="On-chain admin">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <StatusDot ok={status?.configuredSigners?.admin === status?.onChain?.admin} />
                      <AddressPill value={status?.onChain?.admin} />
                    </Stack>
                  </StatCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <StatCard label="Configured maker signer">
                    <AddressPill value={status?.configuredSigners?.maker} />
                  </StatCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <StatCard label="Configured checker signer">
                    <AddressPill value={status?.configuredSigners?.checker} />
                  </StatCard>
                </Grid>
              </Grid>
            </Stack>

            <Divider />

            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.secondary', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Recommended sequence
              </Typography>
              <Grid container spacing={2}>
                {[
                  { step: '1', title: 'Verify environment', body: 'Confirm RPC, program ID, config PDA, and current admin mapping before taking any action.' },
                  { step: '2', title: 'Apply authority changes', body: 'Register checker wallets first, then rotate admin only when the replacement signer is ready.' },
                  { step: '3', title: 'Create managed assets', body: 'Mint tokens only with the configured admin wallet so explorer links and portal records stay aligned.' },
                ].map((item) => (
                  <Grid key={item.step} size={{ xs: 12, md: 4 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        height: '100%',
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: alpha(theme.palette.primary.main, 0.025),
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            border: '1.5px solid',
                            borderColor: 'primary.main',
                            color: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            flexShrink: 0,
                            mt: '1px',
                          }}
                        >
                          {item.step}
                        </Box>
                        <Stack spacing={0.4}>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{item.title}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>{item.body}</Typography>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </Stack>
        </TabPanel>

        {/* ─── Tab 1: Checkers ──────────────────────────────────────────── */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 7 }}>
              <SectionCard
                title={<Typography sx={{ fontWeight: 700 }}>Registered checkers</Typography>}
                description="Checker wallets can approve and reject requests on chain. Remove stale entries to keep the boundary tight."
              >
                <AppTable
                  columns={[
                    {
                      key: 'address',
                      label: 'Address',
                      render: (row) => (
                        <Stack spacing={0.75} sx={{ py: 0.5 }}>
                          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600 }}>
                            {truncateMiddle(row.address, 12, 10)}
                          </Typography>
                          <Stack direction="row" flexWrap="wrap" gap={0.75}>
                            {row.isAdmin && (
                              <Chip label="Admin wallet" size="small" color="warning" sx={{ fontWeight: 700, fontSize: '0.64rem', height: 18 }} />
                            )}
                            {row.isConfiguredChecker && (
                              <Chip label="Backend checker" size="small" color="success" sx={{ fontWeight: 700, fontSize: '0.64rem', height: 18 }} />
                            )}
                          </Stack>
                        </Stack>
                      ),
                    },
                    {
                      key: 'actions',
                      label: '',
                      align: 'right',
                      disableRowClick: true,
                      render: (row) => (
                        <Button
                          color="error"
                          disabled={row.isAdmin || submitting.removingChecker === row.address}
                          onClick={async () => {
                            try {
                              setSubmitting((c) => ({ ...c, removingChecker: row.address }));
                              const response = await solanaAdminApi.removeChecker(row.address);
                              setStatus(response.data);
                              enqueueSnackbar('Checker removed on chain', { variant: 'success' });
                            } catch (actionError) {
                              enqueueSnackbar(getErrorMessage(actionError, 'Unable to remove checker'), { variant: 'error' });
                            } finally {
                              setSubmitting((c) => ({ ...c, removingChecker: '' }));
                            }
                          }}
                          size="small"
                          variant="outlined"
                          sx={{ borderRadius: 2 }}
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
              </SectionCard>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <SectionCard
                title={<Typography sx={{ fontWeight: 700 }}>Register new checker</Typography>}
                description="Add a checker wallet address to the on-chain registry."
              >
                <Stack spacing={2}>
                  <FormGroup label="Checker address">
                    <TextField
                      fullWidth
                      placeholder="Solana wallet address"
                      size="small"
                      onChange={(e) => setCheckerAddress(e.target.value)}
                      value={checkerAddress}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontFamily: 'monospace', fontSize: '0.82rem' } }}
                    />
                  </FormGroup>
                  <Button
                    disabled={!checkerAddress.trim() || submitting.addChecker}
                    onClick={handleAddChecker}
                    fullWidth
                    variant="contained"
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  >
                    {submitting.addChecker ? 'Adding…' : 'Add checker'}
                  </Button>
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>
        </TabPanel>

        {/* ─── Tab 2: Create Mint ───────────────────────────────────────── */}
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3} justifyContent="center">
            <Grid size={{ xs: 12, md: 8, lg: 7 }}>
              <SectionCard
                title={<Typography sx={{ fontWeight: 700 }}>Create managed token mint</Typography>}
                description="Mints created here are placed under program-controlled authority so supply increases flow through the approval gate."
                headerAction={
                  !walletConnected
                    ? (
                      <Button onClick={connect} size="small" variant="outlined" sx={{ borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Connect wallet
                      </Button>
                    )
                    : null
                }
              >
                <Stack spacing={3}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormGroup label="Token name">
                        <TextField
                          fullWidth
                          placeholder="e.g. Solana USD"
                          size="small"
                          onChange={(e) => setMintName(e.target.value)}
                          value={mintName}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </FormGroup>
                    </Grid>
                    <Grid size={{ xs: 8, sm: 4 }}>
                      <FormGroup label="Symbol">
                        <TextField
                          fullWidth
                          placeholder="SUSD"
                          size="small"
                          onChange={(e) => setMintSymbol(e.target.value)}
                          value={mintSymbol}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </FormGroup>
                    </Grid>
                    <Grid size={{ xs: 4, sm: 2 }}>
                      <FormGroup label="Decimals">
                        <TextField
                          fullWidth
                          inputProps={{ min: 0, max: 9 }}
                          size="small"
                          type="number"
                          onChange={(e) => setMintDecimals(e.target.value)}
                          value={mintDecimals}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </FormGroup>
                    </Grid>
                    <Grid size={12}>
                      <FormGroup label="Metadata URI">
                        <TextField
                          fullWidth
                          placeholder="https://..."
                          size="small"
                          onChange={(e) => setMintUri(e.target.value)}
                          value={mintUri}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </FormGroup>
                    </Grid>
                  </Grid>

                  <Button
                    disabled={!canCreateMint}
                    onClick={async () => {
                      try {
                        setSubmitting((c) => ({ ...c, createMint: true }));
                        if (!walletProvider) throw new Error('Wallet provider is not available.');

                        const preparationResponse = await solanaAdminApi.prepareMintCreation();
                        const executionPayload = preparationResponse.data;

                        if (
                          executionPayload.expectedAdminWalletAddress
                          && executionPayload.expectedAdminWalletAddress !== connectedWalletAddress
                        ) {
                          throw new Error(`Connected wallet must match configured admin ${executionPayload.expectedAdminWalletAddress}.`);
                        }

                        const builtTransaction = await buildAdminMintCreationTransaction({
                          executionPayload,
                          adminWalletAddress: connectedWalletAddress,
                          decimals: Number(mintDecimals || 0),
                          name: mintName.trim(),
                          symbol: mintSymbol.trim(),
                          metadataUri: mintUri.trim(),
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
                          metadataAddress: builtTransaction.metadataAddress,
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
                        enqueueSnackbar(getErrorMessage(actionError, 'Unable to create token mint'), { variant: 'error' });
                      } finally {
                        setSubmitting((c) => ({ ...c, createMint: false }));
                      }
                    }}
                    fullWidth
                    variant="contained"
                    size="large"
                    sx={{ borderRadius: 2.5, fontWeight: 700 }}
                  >
                    {submitting.createMint ? 'Creating mint…' : 'Create token mint'}
                  </Button>

                  {latestMint && (
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: alpha(theme.palette.success.main, 0.3),
                        bgcolor: alpha(theme.palette.success.main, 0.04),
                      }}
                    >
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label="Created" size="small" color="success" sx={{ fontWeight: 700, fontSize: '0.64rem', height: 18 }} />
                          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                            {latestMint.name}
                            <Typography component="span" color="text.secondary" sx={{ fontWeight: 400, ml: 0.5 }}>
                              ({latestMint.symbol})
                            </Typography>
                          </Typography>
                        </Stack>
                        <AddressPill value={latestMint.mintAddress} />
                        <Typography variant="caption" color="text.secondary">
                          Supply {latestMint.supply} · {latestMint.decimals} decimals
                        </Typography>
                      </Stack>
                    </Paper>
                  )}
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>
        </TabPanel>

        {/* ─── Tab 3: Authority ─────────────────────────────────────────── */}
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard
                title={<Typography sx={{ fontWeight: 700 }}>Register checker</Typography>}
                description="Register checker wallets before rotating admin authority to avoid signer drift."
              >
                <Stack spacing={2}>
                  <FormGroup label="Checker address">
                    <TextField
                      fullWidth
                      placeholder="Solana wallet address"
                      size="small"
                      onChange={(e) => setCheckerAddress(e.target.value)}
                      value={checkerAddress}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontFamily: 'monospace', fontSize: '0.82rem' } }}
                    />
                  </FormGroup>
                  <Button
                    disabled={!checkerAddress.trim() || submitting.addChecker}
                    onClick={handleAddChecker}
                    fullWidth
                    variant="contained"
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  >
                    {submitting.addChecker ? 'Adding…' : 'Add checker'}
                  </Button>
                </Stack>
              </SectionCard>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard
                warningBorder
                title={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontWeight: 700 }}>Rotate admin authority</Typography>
                    <Chip label="Destructive" size="small" color="warning" sx={{ fontWeight: 700, fontSize: '0.64rem', height: 18 }} />
                  </Stack>
                }
                description="Permanently transfers on-chain admin control to a new address."
              >
                <Stack spacing={2}>
                  <Alert severity="warning" sx={{ borderRadius: 2, py: 0.75 }}>
                    Only rotate when the backend environment will be updated to the same signer simultaneously.
                  </Alert>
                  <FormGroup label="New admin address">
                    <TextField
                      fullWidth
                      placeholder="New admin wallet address"
                      size="small"
                      onChange={(e) => setNewAdminAddress(e.target.value)}
                      value={newAdminAddress}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontFamily: 'monospace', fontSize: '0.82rem' } }}
                    />
                  </FormGroup>
                  <Button
                    color="warning"
                    disabled={!newAdminAddress.trim() || submitting.setAdmin}
                    onClick={async () => {
                      try {
                        setSubmitting((c) => ({ ...c, setAdmin: true }));
                        const response = await solanaAdminApi.setAdmin(newAdminAddress.trim());
                        setStatus(response.data);
                        setNewAdminAddress('');
                        enqueueSnackbar('On-chain admin updated', { variant: 'success' });
                      } catch (actionError) {
                        enqueueSnackbar(getErrorMessage(actionError, 'Unable to rotate admin'), { variant: 'error' });
                      } finally {
                        setSubmitting((c) => ({ ...c, setAdmin: false }));
                      }
                    }}
                    fullWidth
                    variant="contained"
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  >
                    {submitting.setAdmin ? 'Updating…' : 'Set new admin'}
                  </Button>
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>
    </Stack>
  );
}

export default SolanaAdminPage;
