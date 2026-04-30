import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import ErrorState from '../../components/common/ErrorState';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import { banksApi } from '../../modules/banks/banks.api';
import { reservesApi } from '../../modules/reserves/reserves.api';
import { formatReserveLabel } from '../../modules/reserves/reserves.schemas';
import { managedTokensApi } from '../../modules/solana/managedTokens.api';
import { settlementsApi } from '../../modules/settlements/settlements.api';
import {
  interbankTransferSettlementSchema,
  redemptionSettlementSchema,
  replenishmentMintSettlementSchema,
  reserveMintSettlementSchema,
  settlementRequestTypeOptions,
} from '../../modules/settlements/settlements.schemas';
import { REQUEST_TYPES } from '../../utils/constants';
import { getErrorMessage } from '../../utils/error';

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

function SettlementCreatePage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [banks, setBanks] = useState([]);
  const [managedTokens, setManagedTokens] = useState([]);
  const [reserves, setReserves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    async function loadBootstrapData() {
      try {
        setLoading(true);
        setError('');
        const [banksResponse, tokensResponse, reservesResponse] = await Promise.all([
          banksApi.list({ limit: 100, isActive: true }),
          managedTokensApi.list({ page: 1, limit: 100 }),
          reservesApi.list({
            page: 1,
            limit: 100,
            status: 'APPROVED',
            referenceType: 'PAYMENT_GATEWAY',
          }),
        ]);
        const loadedBanks = banksResponse.data.items || [];
        setBanks(loadedBanks);
        setManagedTokens(tokensResponse.data.items || []);
        setReserves(reservesResponse.data.items || []);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load settlement setup data.');
      } finally {
        setLoading(false);
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
  const availableReserveLedgers = useMemo(() => {
    if (!sourceBank?.id) {
      return [];
    }

    return reserves.filter((reserve) =>
      reserve.bankId === sourceBank.id
      && reserve.referenceType === 'PAYMENT_GATEWAY'
      && reserve.status === 'APPROVED'
      && Number(reserve.availableAmount || 0) > 0,
    );
  }, [reserves, sourceBank]);
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
      const hasSelectedReserve = availableReserveLedgers.some((ledger) => ledger.id === form.reserveLedgerId);

      if (!hasSelectedReserve && form.reserveLedgerId) {
        setForm((current) => ({
          ...current,
          reserveLedgerId: '',
        }));
      }
    }
  }, [availableReserveLedgers, form.requestType, form.reserveLedgerId]);

  const submit = async () => {
    try {
      setSaving(true);
      let response;

      if (form.requestType === REQUEST_TYPES.RESERVE_MINT) {
        const payload = reserveMintSettlementSchema.parse({
          sourceBankId: form.sourceBankId,
          reserveLedgerId: form.reserveLedgerId,
          tokenMintAddress: form.tokenMintAddress,
          amount: form.amount,
          transferPurpose: form.transferPurpose || null,
        });
        response = await settlementsApi.createReserveMint(payload);
      } else if (form.requestType === REQUEST_TYPES.REPLENISHMENT_MINT) {
        const payload = replenishmentMintSettlementSchema.parse({
          sourceBankId: form.sourceBankId,
          reserveLedgerId: form.reserveLedgerId,
          tokenMintAddress: form.tokenMintAddress,
          amount: form.amount,
          transferPurpose: form.transferPurpose || null,
        });
        response = await settlementsApi.createReplenishmentMint(payload);
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

            {form.requestType === REQUEST_TYPES.RESERVE_MINT || form.requestType === REQUEST_TYPES.REPLENISHMENT_MINT ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">Reserve ledger</span>
                <Select value={form.reserveLedgerId} onChange={(event) => setForm((current) => ({ ...current, reserveLedgerId: event.target.value }))}>
                  <option value="">Select approved reserve</option>
                  {availableReserveLedgers.map((ledger) => (
                    <option key={ledger.id} value={ledger.id}>
                      {formatReserveLabel(ledger)}
                    </option>
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
              <Input value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            </label>

            {(form.requestType === REQUEST_TYPES.INTERBANK_TRANSFER || form.requestType === REQUEST_TYPES.REDEMPTION) ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">Request ID</span>
                <Input value={form.requestId} onChange={(event) => setForm((current) => ({ ...current, requestId: event.target.value }))} />
              </label>
            ) : null}
          </div>

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
                  Reserve source: {(() => {
                    const selectedReserve = availableReserveLedgers.find((ledger) => ledger.id === form.reserveLedgerId);
                    return selectedReserve ? formatReserveLabel(selectedReserve) : '-';
                  })()}
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
