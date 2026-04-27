import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';

import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import { solanaAdminApi } from '../../modules/solana/solana.api';
import {
  buildAdminMintCreationTransaction,
  buildExplorerTransactionUrl,
  signAndSendWalletTransaction,
} from '../../modules/solana/walletExecution';
import { getErrorMessage } from '../../utils/error';
import { truncateMiddle } from '../../utils/format';

function MetricCard({ label, mono = false, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-2 break-all text-sm ${mono ? 'font-mono text-zinc-200' : 'text-zinc-300'}`}>{value || '—'}</p>
    </div>
  );
}

function Field({ label, description, children }) {
  return (
    <label className="block space-y-2">
      <div className="space-y-1">
        <span className="block text-sm font-medium text-zinc-200">{label}</span>
        {description ? <span className="block text-sm text-zinc-400">{description}</span> : null}
      </div>
      {children}
    </label>
  );
}

function SectionCard({ children, description, title }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
      <div className="mb-5 space-y-1">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description ? <p className="text-sm text-zinc-400">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function SolanaAdminPage() {
  const { enqueueSnackbar } = useSnackbar();
  const {
    address: connectedWalletAddress,
    connected: walletConnected,
    provider: walletProvider,
    connect,
  } = useSolanaWallet();

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
    (async () => {
      await loadStatus();
    })();
  }, []);

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

  const canCreateMint = Boolean(
    !submitting.createMint
      && mintName.trim()
      && mintSymbol.trim()
      && mintUri.trim()
      && walletConnected
      && !adminWalletMismatch,
  );

  const handleAddChecker = async () => {
    try {
      setSubmitting((current) => ({ ...current, addChecker: true }));
      const response = await solanaAdminApi.addChecker(checkerAddress.trim());
      setStatus(response.data);
      setCheckerAddress('');
      enqueueSnackbar('Checker added on chain', { variant: 'success' });
    } catch (actionError) {
      enqueueSnackbar(getErrorMessage(actionError, 'Unable to add checker'), { variant: 'error' });
    } finally {
      setSubmitting((current) => ({ ...current, addChecker: false }));
    }
  };

  if (loading && !status) {
    return <LoadingScreen message="Loading Solana admin controls..." />;
  }

  if (error && !status) {
    return <ErrorState description={error} onAction={loadStatus} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Inspect live config, manage checkers, rotate authority, and create managed token mints."
        title="Solana Admin"
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          description="Current RPC, program, config PDA, and signer alignment for the active environment."
          title="Environment Status"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="RPC URL" value={status?.rpcUrl} />
            <MetricCard label="Commitment" value={status?.commitment} />
            <MetricCard label="Program ID" mono value={status?.programId} />
            <MetricCard label="Config Address" mono value={status?.configAddress} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Configured Admin" mono value={status?.configuredSigners?.admin} />
            <MetricCard label="Configured Checker" mono value={status?.configuredSigners?.checker} />
            <MetricCard label="On-chain Admin" mono value={status?.onChain?.admin} />
          </div>
        </SectionCard>

        <SectionCard
          description="Connect the configured admin wallet before running wallet-backed mint creation."
          title="Wallet Readiness"
        >
          <div className="space-y-3">
            {walletConnected ? (
              <Alert tone={adminWalletMismatch ? 'warning' : 'success'}>
                {adminWalletMismatch
                  ? `Connected wallet ${truncateMiddle(connectedWalletAddress, 8, 6)} does not match configured admin ${truncateMiddle(status?.configuredSigners?.admin || '', 8, 6)}.`
                  : `Connected: ${truncateMiddle(connectedWalletAddress || '', 10, 8)}`}
              </Alert>
            ) : (
              <Alert tone="info">Connect the admin Phantom wallet before creating managed token mints.</Alert>
            )}

            {(status?.warnings || []).map((warning) => (
              <Alert key={warning} tone="warning">{warning}</Alert>
            ))}

            <div className="flex flex-wrap gap-2">
              {!walletConnected ? (
                <Button onClick={connect} variant="secondary">Connect Wallet</Button>
              ) : null}
              <Button onClick={loadStatus} variant="outline">Refresh Status</Button>
            </div>
          </div>
        </SectionCard>
      </div>

      <TabGroup>
        <TabList className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
          {['Overview', 'Checkers', 'Create Mint', 'Authority'].map((label) => (
            <Tab
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 outline-none transition data-[selected]:bg-white/10 data-[selected]:text-white hover:text-white"
              key={label}
            >
              {label}
            </Tab>
          ))}
        </TabList>

        <TabPanels className="mt-6">
          <TabPanel className="space-y-6">
            <SectionCard
              description="High-level indicators for operational readiness and signer alignment."
              title="Operational Snapshot"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-zinc-400">Config present</span>
                    <Badge tone={status?.configExists ? 'emerald' : 'amber'}>
                      {status?.configExists ? 'OK' : 'Review'}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-zinc-400">Admin signer aligned</span>
                    <Badge tone={status?.canManageOnChainConfig ? 'emerald' : 'amber'}>
                      {status?.canManageOnChainConfig ? 'OK' : 'Review'}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-zinc-400">Checker registered</span>
                    <Badge tone={status?.checkerSignerConfiguredOnChain ? 'emerald' : 'amber'}>
                      {status?.checkerSignerConfiguredOnChain ? 'OK' : 'Review'}
                    </Badge>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              description="Recommended sequence for safe environment changes."
              title="Recommended Sequence"
            >
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    step: '1',
                    title: 'Verify environment',
                    body: 'Confirm RPC, program ID, config PDA, and current admin mapping before taking any action.',
                  },
                  {
                    step: '2',
                    title: 'Register checker',
                    body: 'Add or confirm checker wallets before rotating admin authority or creating test assets.',
                  },
                  {
                    step: '3',
                    title: 'Create assets',
                    body: 'Create managed mints only after the correct admin wallet is connected and status is healthy.',
                  },
                ].map((item) => (
                  <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-4" key={item.step}>
                    <div className="flex items-start gap-3">
                      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs font-semibold text-white">
                        {item.step}
                      </span>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                        <p className="text-sm text-zinc-400">{item.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </TabPanel>

          <TabPanel className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <SectionCard
              description="Checker wallets can approve and reject requests on chain."
              title="Registered Checkers"
            >
              <AppTable
                columns={[
                  {
                    key: 'address',
                    label: 'Address',
                    render: (row) => (
                      <div className="space-y-2 py-1">
                        <p className="font-mono text-sm text-zinc-200">{truncateMiddle(row.address, 12, 10)}</p>
                        <div className="flex flex-wrap gap-1">
                          {row.isAdmin ? <Badge tone="amber">Admin wallet</Badge> : null}
                          {row.isConfiguredChecker ? <Badge tone="emerald">Backend checker</Badge> : null}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'actions',
                    label: 'Actions',
                    align: 'right',
                    disableRowClick: true,
                    render: (row) => (
                      <Button
                        disabled={row.isAdmin || submitting.removingChecker === row.address}
                        onClick={async () => {
                          try {
                            setSubmitting((current) => ({ ...current, removingChecker: row.address }));
                            const response = await solanaAdminApi.removeChecker(row.address);
                            setStatus(response.data);
                            enqueueSnackbar('Checker removed on chain', { variant: 'success' });
                          } catch (actionError) {
                            enqueueSnackbar(getErrorMessage(actionError, 'Unable to remove checker'), { variant: 'error' });
                          } finally {
                            setSubmitting((current) => ({ ...current, removingChecker: '' }));
                          }
                        }}
                        size="sm"
                        variant="danger"
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

            <SectionCard
              description="Add a checker wallet address to the on-chain registry."
              title="Register New Checker"
            >
              <div className="space-y-4">
                <Field label="Checker address">
                  <Input
                    className="font-mono"
                    onChange={(event) => setCheckerAddress(event.target.value)}
                    placeholder="Solana wallet address"
                    value={checkerAddress}
                  />
                </Field>
                <Button
                  disabled={!checkerAddress.trim() || submitting.addChecker}
                  onClick={handleAddChecker}
                  variant="secondary"
                >
                  {submitting.addChecker ? 'Adding...' : 'Add checker'}
                </Button>
              </div>
            </SectionCard>
          </TabPanel>

          <TabPanel className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <SectionCard
              description="Mints created here are placed under program-controlled authority so supply increases flow through the approval gate."
              title="Create Managed Token Mint"
            >
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Token name">
                    <Input onChange={(event) => setMintName(event.target.value)} placeholder="e.g. Solana USD" value={mintName} />
                  </Field>
                  <Field label="Symbol">
                    <Input onChange={(event) => setMintSymbol(event.target.value)} placeholder="SUSD" value={mintSymbol} />
                  </Field>
                  <Field label="Decimals">
                    <Input
                      max="9"
                      min="0"
                      onChange={(event) => setMintDecimals(event.target.value)}
                      type="number"
                      value={mintDecimals}
                    />
                  </Field>
                  <Field label="Metadata URI">
                    <Input onChange={(event) => setMintUri(event.target.value)} placeholder="https://..." value={mintUri} />
                  </Field>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!walletConnected ? (
                    <Button onClick={connect} variant="outline">Connect Wallet</Button>
                  ) : null}
                  <Button
                    disabled={!canCreateMint}
                    onClick={async () => {
                      try {
                        setSubmitting((current) => ({ ...current, createMint: true }));
                        if (!walletProvider) {
                          throw new Error('Wallet provider is not available.');
                        }

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
                          partialSigners: [builtTransaction.mintKeypair],
                          provider: walletProvider,
                          transaction: builtTransaction.transaction,
                        });

                        const recordResponse = await solanaAdminApi.recordCreatedTokenMint({
                          adminWalletAddress: connectedWalletAddress,
                          decimals: Number(mintDecimals || 0),
                          explorerUrl: buildExplorerTransactionUrl(txSignature, executionPayload.rpcUrl),
                          freezeAuthority: executionPayload.tokenAuthority,
                          metadataAddress: builtTransaction.metadataAddress,
                          metadataUri: mintUri.trim(),
                          mintAddress: builtTransaction.mintAddress,
                          mintAuthority: executionPayload.tokenAuthority,
                          name: mintName.trim(),
                          symbol: mintSymbol.trim(),
                          tokenAuthority: executionPayload.tokenAuthority,
                          txSignature,
                        });

                        setLatestMint(recordResponse.data);
                        setMintName('');
                        setMintSymbol('');
                        setMintUri('');
                        enqueueSnackbar('Managed token mint created', { variant: 'success' });
                      } catch (actionError) {
                        enqueueSnackbar(getErrorMessage(actionError, 'Unable to create token mint'), { variant: 'error' });
                      } finally {
                        setSubmitting((current) => ({ ...current, createMint: false }));
                      }
                    }}
                    variant="secondary"
                  >
                    {submitting.createMint ? 'Creating mint...' : 'Create token mint'}
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              description="Recent mint creation output for the current session."
              title="Latest Mint"
            >
              {latestMint ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="emerald">Created</Badge>
                    <h3 className="text-sm font-semibold text-white">
                      {latestMint.name} <span className="font-normal text-zinc-400">({latestMint.symbol})</span>
                    </h3>
                  </div>
                  <p className="break-all font-mono text-sm text-zinc-300">{latestMint.mintAddress}</p>
                  <p className="text-sm text-zinc-400">Supply {latestMint.supply} • {latestMint.decimals} decimals</p>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">No mint created in this session yet.</p>
              )}
            </SectionCard>
          </TabPanel>

          <TabPanel className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              description="Register checker wallets before rotating admin authority."
              title="Register Checker"
            >
              <div className="space-y-4">
                <Field label="Checker address">
                  <Input
                    className="font-mono"
                    onChange={(event) => setCheckerAddress(event.target.value)}
                    placeholder="Solana wallet address"
                    value={checkerAddress}
                  />
                </Field>
                <Button
                  disabled={!checkerAddress.trim() || submitting.addChecker}
                  onClick={handleAddChecker}
                  variant="secondary"
                >
                  {submitting.addChecker ? 'Adding...' : 'Add checker'}
                </Button>
              </div>
            </SectionCard>

            <SectionCard
              description="Permanently transfers on-chain admin control to a new address."
              title="Rotate Admin Authority"
            >
              <div className="space-y-4">
                <Alert tone="warning">
                  Only rotate when the backend environment will be updated to the same signer simultaneously.
                </Alert>
                <Field label="New admin address">
                  <Input
                    className="font-mono"
                    onChange={(event) => setNewAdminAddress(event.target.value)}
                    placeholder="New admin wallet address"
                    value={newAdminAddress}
                  />
                </Field>
                <Button
                  disabled={!newAdminAddress.trim() || submitting.setAdmin}
                  onClick={async () => {
                    try {
                      setSubmitting((current) => ({ ...current, setAdmin: true }));
                      const response = await solanaAdminApi.setAdmin(newAdminAddress.trim());
                      setStatus(response.data);
                      setNewAdminAddress('');
                      enqueueSnackbar('On-chain admin updated', { variant: 'success' });
                    } catch (actionError) {
                      enqueueSnackbar(getErrorMessage(actionError, 'Unable to rotate admin'), { variant: 'error' });
                    } finally {
                      setSubmitting((current) => ({ ...current, setAdmin: false }));
                    }
                  }}
                  variant="danger"
                >
                  {submitting.setAdmin ? 'Updating...' : 'Set new admin'}
                </Button>
              </div>
            </SectionCard>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}

export default SolanaAdminPage;
