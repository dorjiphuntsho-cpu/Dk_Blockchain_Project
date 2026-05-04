import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import ErrorState from '../../components/common/ErrorState';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import ReserveBalancePanel from '../../components/cbs/ReserveBalancePanel';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import { banksApi } from '../../modules/banks/banks.api';
import { cbsApi } from '../../modules/cbs/cbs.api';
import {
  buildExplorerTransactionUrl,
  buildMakerInitiationTransaction,
  signAndSendMakerTransaction,
} from '../../modules/solana/walletExecution';
import { managedTokensApi } from '../../modules/solana/managedTokens.api';
import { settlementsApi } from '../../modules/settlements/settlements.api';
import {
  interbankTransferSettlementSchema,
  redemptionSettlementSchema,
  replenishmentMintSettlementSchema,
  reserveMintSettlementSchema,
  settlementRequestTypeOptions,
} from '../../modules/settlements/settlements.schemas';
import {
  clearPendingInitiationRecovery,
  savePendingInitiationRecovery,
} from '../../modules/tokenRequests/tokenRequestRecovery';
import { REQUEST_TYPES } from '../../utils/constants';
import { getErrorMessage } from '../../utils/error';
import { formatAmount } from '../../utils/format';

const initialForm = {
  requestType: REQUEST_TYPES.INTERBANK_TRANSFER,
  sourceBankId: '',
  destinationBankId: '',
  reserveLedgerId: '',
  tokenMintAddress: '',
  amount: '',
  transferPurpose: '',
  requestId: '',
  beneficiaryAccountName: '',
  beneficiaryAccountNumber: '',
  beneficiaryBankCode: '',
  sourceAccountName: '',
  sourceAccountNumber: '',
};

function formatReserveDerivedAmount(value) {
  const numericValue = Number(value || 0);

  if (!Number.isFinite(numericValue)) {
    return '0';
  }

  return String(Math.round(numericValue));
}

function SettlementCreatePage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const {
    address: connectedWalletAddress,
    available: walletAvailable,
    connect: connectWallet,
    connected: walletConnected,
    provider: walletProvider,
  } = useSolanaWallet();
  const [banks, setBanks] = useState([]);
  const [managedTokens, setManagedTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(initialForm);
  const [reserveBalance, setReserveBalance] = useState(null);
  const [reserveBalanceLoading, setReserveBalanceLoading] = useState(true);
  const [reserveBalanceError, setReserveBalanceError] = useState('');

  useEffect(() => {
    async function loadBootstrapData() {
      try {
        setLoading(true);
        setError('');
        const [banksResponse, tokensResponse] = await Promise.all([
          banksApi.list({ limit: 100, isActive: true }),
          managedTokensApi.list({ page: 1, limit: 100 }),
        ]);
        const loadedBanks = banksResponse.data.items || [];
        setBanks(loadedBanks);
        setManagedTokens(tokensResponse.data.items || []);

        try {
          const reserveBalanceResponse = await cbsApi.getIssuerReserveBalance();
          setReserveBalance(reserveBalanceResponse.data);
          setReserveBalanceError('');
        } catch (reserveLoadError) {
          setReserveBalance(null);
          setReserveBalanceError(getErrorMessage(reserveLoadError, 'Unable to load DK Bank fiat reserve balance.'));
        }
      } catch (loadError) {
        setError(loadError.message || 'Unable to load settlement setup data.');
      } finally {
        setLoading(false);
        setReserveBalanceLoading(false);
      }
    }

    void loadBootstrapData();
  }, []);

  const sourceBank = useMemo(
    () => banks.find((bank) => bank.id === form.sourceBankId) || null,
    [banks, form.sourceBankId],
  );
  const destinationBank = useMemo(
    () => banks.find((bank) => bank.id === form.destinationBankId) || null,
    [banks, form.destinationBankId],
  );
  const issuerBank = useMemo(
    () => banks.find((bank) => bank.isIssuer) || null,
    [banks],
  );
  const reserveFiatAvailableAmount = Number(
    reserveBalance?.inquiry?.availableBalance
    ?? 0,
  );
  const reserveMintAmount = reserveFiatAvailableAmount > 0
    ? Math.round(reserveFiatAvailableAmount * 0.8)
    : 0;
  const availableManagedTokens = useMemo(() => {
    const allManagedTokens = managedTokens.filter((token) => token.mintAddress);

    if (form.requestType !== REQUEST_TYPES.RESERVE_MINT && form.requestType !== REQUEST_TYPES.REPLENISHMENT_MINT) {
      return allManagedTokens;
    }

    const issuerMintAddresses = new Set(
      (sourceBank?.tokenAccounts || [])
        .filter((account) => account.isActive && account.mintAddress)
        .map((account) => account.mintAddress),
    );

    return allManagedTokens.filter((token) => issuerMintAddresses.has(token.mintAddress));
  }, [form.requestType, managedTokens, sourceBank]);

  useEffect(() => {
    const isReserveMintFlow =
      form.requestType === REQUEST_TYPES.RESERVE_MINT
      || form.requestType === REQUEST_TYPES.REPLENISHMENT_MINT;

    if (!isReserveMintFlow) {
      return;
    }

    const currentTokenIsAvailable = availableManagedTokens.some(
      (token) => token.mintAddress === form.tokenMintAddress,
    );

    if (currentTokenIsAvailable) {
      return;
    }

    const preferredToken =
      availableManagedTokens.find((token) => token.symbol === 'BTN')
      || availableManagedTokens.find((token) => String(token.name || '').toUpperCase().includes('BTN'))
      || availableManagedTokens[0]
      || null;

    if (form.tokenMintAddress !== (preferredToken?.mintAddress || '')) {
      setForm((current) => ({
        ...current,
        tokenMintAddress: preferredToken?.mintAddress || '',
      }));
    }
  }, [availableManagedTokens, form.requestType, form.tokenMintAddress]);

  const routePreview = useMemo(() => {
    if (form.requestType === REQUEST_TYPES.RESERVE_MINT || form.requestType === REQUEST_TYPES.REPLENISHMENT_MINT) {
      return 'Issuer-backed BTN mint';
    }

    if (form.requestType === REQUEST_TYPES.REDEMPTION) {
      return 'Fiat payout via BIPS';
    }

    const hasMatchingBtnDestination = (destinationBank?.tokenAccounts || []).some(
      (account) => account.isActive && account.mintAddress === form.tokenMintAddress,
    );

    if (destinationBank?.supportsBtn && hasMatchingBtnDestination) {
      return 'Direct BTN transfer';
    }

    return destinationBank ? 'Fiat fallback via BIPS' : 'Select destination bank to preview route';
  }, [destinationBank, form.requestType, form.tokenMintAddress]);

  useEffect(() => {
    if (
      (form.requestType === REQUEST_TYPES.RESERVE_MINT || form.requestType === REQUEST_TYPES.REPLENISHMENT_MINT)
      && issuerBank
      && form.sourceBankId !== issuerBank.id
    ) {
      setForm((current) => ({
        ...current,
        sourceBankId: issuerBank.id,
      }));
    }
  }, [form.requestType, form.sourceBankId, issuerBank]);

  useEffect(() => {
    if (
      form.requestType === REQUEST_TYPES.RESERVE_MINT
      || form.requestType === REQUEST_TYPES.REPLENISHMENT_MINT
    ) {
      const derivedAmount = reserveMintAmount > 0 ? formatReserveDerivedAmount(reserveMintAmount) : '';

      if (form.amount !== derivedAmount) {
        setForm((current) => ({
          ...current,
          amount: derivedAmount,
        }));
      }
    }
  }, [form.amount, form.requestType, reserveMintAmount]);

  const submit = async () => {
    try {
      setSaving(true);
      let response;
      let savedSettlementId = null;

      if (form.requestType === REQUEST_TYPES.RESERVE_MINT) {
        if (reserveBalanceLoading) {
          throw new Error('DK Bank reserve fiat balance is still loading.');
        }

        if (reserveFiatAvailableAmount <= 0) {
          throw new Error('DK Bank reserve fiat balance is unavailable or zero.');
        }

        const payload = reserveMintSettlementSchema.parse({
          sourceBankId: form.sourceBankId,
          tokenMintAddress: form.tokenMintAddress,
          amount: form.amount,
          transferPurpose: form.transferPurpose || null,
        });
        response = await settlementsApi.createReserveMint(payload);
        savedSettlementId = response.data.id;

        let makerWalletAddress = connectedWalletAddress;

        if (!walletConnected || !makerWalletAddress) {
          if (!walletAvailable || !connectWallet) {
            throw new Error('Connect the maker wallet before creating this settlement.');
          }

          makerWalletAddress = await connectWallet();
        }

        if (!makerWalletAddress) {
          throw new Error('Connect the maker wallet before creating this settlement.');
        }

        if (!walletProvider) {
          throw new Error('Wallet provider is not available.');
        }

        const prepareResponse = await settlementsApi.prepareMintRequest(savedSettlementId, makerWalletAddress);
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

        savePendingInitiationRecovery(savedSettlementId, initiationPayload);
        await settlementsApi.recordMintInitiation(savedSettlementId, initiationPayload);
        clearPendingInitiationRecovery(savedSettlementId);

        enqueueSnackbar('Settlement created and wallet initiation submitted.', { variant: 'success' });
        navigate(`/settlements/${savedSettlementId}`);
        return;
      } else if (form.requestType === REQUEST_TYPES.REPLENISHMENT_MINT) {
        if (reserveBalanceLoading) {
          throw new Error('DK Bank reserve fiat balance is still loading.');
        }

        if (reserveFiatAvailableAmount <= 0) {
          throw new Error('DK Bank reserve fiat balance is unavailable or zero.');
        }

        const payload = replenishmentMintSettlementSchema.parse({
          sourceBankId: form.sourceBankId,
          tokenMintAddress: form.tokenMintAddress,
          amount: form.amount,
          transferPurpose: form.transferPurpose || null,
        });
        response = await settlementsApi.createReplenishmentMint(payload);
        savedSettlementId = response.data.id;

        let makerWalletAddress = connectedWalletAddress;

        if (!walletConnected || !makerWalletAddress) {
          if (!walletAvailable || !connectWallet) {
            throw new Error('Connect the maker wallet before creating this settlement.');
          }

          makerWalletAddress = await connectWallet();
        }

        if (!makerWalletAddress) {
          throw new Error('Connect the maker wallet before creating this settlement.');
        }

        if (!walletProvider) {
          throw new Error('Wallet provider is not available.');
        }

        const prepareResponse = await settlementsApi.prepareMintRequest(savedSettlementId, makerWalletAddress);
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

        savePendingInitiationRecovery(savedSettlementId, initiationPayload);
        await settlementsApi.recordMintInitiation(savedSettlementId, initiationPayload);
        clearPendingInitiationRecovery(savedSettlementId);

        enqueueSnackbar('Settlement created and wallet initiation submitted.', { variant: 'success' });
        navigate(`/settlements/${savedSettlementId}`);
        return;
      } else if (form.requestType === REQUEST_TYPES.REDEMPTION) {
        const payload = redemptionSettlementSchema.parse({
          sourceBankId: form.sourceBankId,
          destinationBankId: form.destinationBankId || null,
          tokenMintAddress: form.tokenMintAddress,
          amount: form.amount,
          transferPurpose: form.transferPurpose,
          requestId: form.requestId,
          beneficiaryAccountName: form.beneficiaryAccountName,
          beneficiaryAccountNumber: form.beneficiaryAccountNumber,
          beneficiaryBankCode: form.beneficiaryBankCode,
          sourceAccountName: form.sourceAccountName,
          sourceAccountNumber: form.sourceAccountNumber,
        });
        response = await settlementsApi.createRedemption(payload);
      } else {
        const payload = interbankTransferSettlementSchema.parse({
          sourceBankId: form.sourceBankId,
          destinationBankId: form.destinationBankId,
          tokenMintAddress: form.tokenMintAddress,
          amount: form.amount,
          transferPurpose: form.transferPurpose,
          requestId: form.requestId || null,
          beneficiaryAccountName: form.beneficiaryAccountName || null,
          beneficiaryAccountNumber: form.beneficiaryAccountNumber || null,
          beneficiaryBankCode: form.beneficiaryBankCode || null,
          sourceAccountName: form.sourceAccountName || null,
          sourceAccountNumber: form.sourceAccountNumber || null,
        });
        response = await settlementsApi.createInterbankTransfer(payload);
      }

      enqueueSnackbar('Settlement created successfully.', { variant: 'success' });
      navigate(`/settlements/${response.data.id}`);
    } catch (submitError) {
      enqueueSnackbar(getErrorMessage(submitError, 'Unable to create settlement'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return <ErrorState description={error} onAction={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Settlement"
        subtitle="Start a reserve mint, direct bank-to-bank BTN transfer, or BIPS-routed fiat fallback request."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-5 rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">Settlement type</span>
              <Select value={form.requestType} onChange={(event) => setForm((current) => ({ ...current, requestType: event.target.value }))}>
                {settlementRequestTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">Source bank</span>
              <Select
                value={form.sourceBankId}
                onChange={(event) => setForm((current) => ({ ...current, sourceBankId: event.target.value }))}
                disabled={form.requestType === REQUEST_TYPES.RESERVE_MINT || form.requestType === REQUEST_TYPES.REPLENISHMENT_MINT}
              >
                <option value="">Select source bank</option>
                {(form.requestType === REQUEST_TYPES.RESERVE_MINT || form.requestType === REQUEST_TYPES.REPLENISHMENT_MINT
                  ? banks.filter((bank) => bank.isIssuer)
                  : banks
                ).map((bank) => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
              </Select>
            </label>

            {form.requestType === REQUEST_TYPES.INTERBANK_TRANSFER || form.requestType === REQUEST_TYPES.REDEMPTION ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">Destination bank</span>
                <Select value={form.destinationBankId} onChange={(event) => setForm((current) => ({ ...current, destinationBankId: event.target.value }))}>
                  <option value="">Select destination bank</option>
                  {banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>{bank.name}</option>
                  ))}
                </Select>
              </label>
            ) : null}

            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">Token mint</span>
              <Select value={form.tokenMintAddress} onChange={(event) => setForm((current) => ({ ...current, tokenMintAddress: event.target.value }))}>
                <option value="">Select token mint</option>
                {availableManagedTokens.map((token) => (
                  <option key={token.id || token.mintAddress} value={token.mintAddress}>
                    {`${token.name || token.symbol || token.mintAddress}${token.symbol ? ` (${token.symbol})` : ''}`}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">Amount</span>
              <Input
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                readOnly={form.requestType === REQUEST_TYPES.RESERVE_MINT || form.requestType === REQUEST_TYPES.REPLENISHMENT_MINT}
              />
            </label>

            {(form.requestType === REQUEST_TYPES.INTERBANK_TRANSFER || form.requestType === REQUEST_TYPES.REDEMPTION) ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">Request ID</span>
                <Input value={form.requestId} onChange={(event) => setForm((current) => ({ ...current, requestId: event.target.value }))} />
              </label>
            ) : null}
          </div>

          {(form.requestType === REQUEST_TYPES.RESERVE_MINT || form.requestType === REQUEST_TYPES.REPLENISHMENT_MINT) ? (
            <div className="space-y-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
              <ReserveBalancePanel
                data={reserveBalance}
                error={reserveBalanceError}
                loading={reserveBalanceLoading}
                subtitle="Reserve minting uses the linked DK Bank fiat reserve balance as the minting reference."
                title="Reserve Fiat"
              />
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Selected Reserve Capacity</h2>
                  <p className="mt-1 text-sm text-zinc-300">
                    Minted BTN should stay within the available fiat-backed reserve amount tracked for DK Bank.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Available reserve fiat</p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    {formatAmount(reserveFiatAvailableAmount)} {reserveBalance?.inquiry?.currencyCode || reserveBalance?.reserveAccount?.currency || 'BTN'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Mint token amount</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {formatAmount(reserveMintAmount)} {reserveBalance?.inquiry?.currencyCode || reserveBalance?.reserveAccount?.currency || 'BTN'}
                </p>
                <p className="mt-2 text-sm text-zinc-300">
                  The mint amount is fixed at 80% of the available reserve balance and rounded to a whole token.
                </p>
              </div>
            </div>
          ) : null}

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-200">Transfer purpose</span>
            <Textarea rows={3} value={form.transferPurpose} onChange={(event) => setForm((current) => ({ ...current, transferPurpose: event.target.value }))} />
          </label>

          {(form.requestType === REQUEST_TYPES.INTERBANK_TRANSFER || form.requestType === REQUEST_TYPES.REDEMPTION) ? (
            <div className="space-y-4 rounded-xl border border-white/10 bg-zinc-950/40 p-4">
              <h2 className="text-sm font-semibold text-white">Fiat fallback details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-zinc-200">Beneficiary account name</span>
                  <Input value={form.beneficiaryAccountName} onChange={(event) => setForm((current) => ({ ...current, beneficiaryAccountName: event.target.value }))} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-zinc-200">Beneficiary account number</span>
                  <Input value={form.beneficiaryAccountNumber} onChange={(event) => setForm((current) => ({ ...current, beneficiaryAccountNumber: event.target.value }))} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-zinc-200">Beneficiary bank code</span>
                  <Input value={form.beneficiaryBankCode} onChange={(event) => setForm((current) => ({ ...current, beneficiaryBankCode: event.target.value }))} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-zinc-200">Source account name</span>
                  <Input value={form.sourceAccountName} onChange={(event) => setForm((current) => ({ ...current, sourceAccountName: event.target.value }))} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-zinc-200">Source account number</span>
                  <Input value={form.sourceAccountNumber} onChange={(event) => setForm((current) => ({ ...current, sourceAccountNumber: event.target.value }))} />
                </label>
              </div>
            </div>
          ) : null}

          <div className="flex gap-3">
            <Button disabled={saving || loading} onClick={submit}>
              {saving ? 'Creating...' : 'Create Settlement'}
            </Button>
            <Button onClick={() => navigate('/settlements')} variant="outline">
              Cancel
            </Button>
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Route Preview</h2>
            <p className="text-sm text-zinc-400">{routePreview}</p>
          </div>
          <div className="space-y-3 text-sm text-zinc-300">
            <p>Source bank: {sourceBank?.name || '-'}</p>
            <p>Destination bank: {destinationBank?.name || '-'}</p>
            <p>Issuer flow: {sourceBank?.isIssuer ? 'Issuer-capable' : 'Standard bank'}</p>
            <p>BTN support at destination: {destinationBank ? (destinationBank.supportsBtn ? 'Enabled' : 'Disabled') : '-'}</p>
            {(form.requestType === REQUEST_TYPES.RESERVE_MINT || form.requestType === REQUEST_TYPES.REPLENISHMENT_MINT) ? (
              <>
                <p>
                  Reserve fiat: {reserveBalance?.inquiry?.availableBalance != null
                    ? `${formatAmount(reserveBalance.inquiry.availableBalance)} ${reserveBalance.inquiry.currencyCode || reserveBalance.reserveAccount?.currency || 'BTN'}`
                    : '-'}
                </p>
                <p>
                  Reserve available balance: {reserveBalance?.inquiry?.availableBalance != null
                    ? `${formatAmount(reserveBalance.inquiry.availableBalance)} ${reserveBalance.inquiry.currencyCode || reserveBalance.reserveAccount?.currency || 'BTN'}`
                    : '-'}
                </p>
                <p>Mint target: {sourceBank?.name ? `${sourceBank.name} treasury token account` : '-'}</p>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default SettlementCreatePage;
