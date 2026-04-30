import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import AppTable from '../../components/common/AppTable';
import { banksApi } from '../../modules/banks/banks.api';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import { solanaAdminApi } from '../../modules/solana/solana.api';
import { getErrorMessage } from '../../utils/error';
import { truncateMiddle } from '../../utils/format';

function buildAccountState(accountType, existingAccount) {
  return {
    accountType,
    accountName: existingAccount?.accountName || '',
    accountNumber: existingAccount?.accountNumber || '',
    currency: existingAccount?.currency || 'BTN',
    isPrimary: existingAccount?.isPrimary ?? true,
    isActive: existingAccount?.isActive ?? true,
    remarks: existingAccount?.remarks || '',
  };
}

function BankDetailsPage() {
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();
  const { address: connectedWalletAddress, connected: walletConnected } = useSolanaWallet();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingReserve, setSavingReserve] = useState(false);
  const [savingBips, setSavingBips] = useState(false);
  const [error, setError] = useState('');
  const [bank, setBank] = useState(null);
  const [solanaStatus, setSolanaStatus] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    binNumber: '',
    panNumber: '',
    treasuryWalletAddress: '',
    supportsBtn: false,
    supportsBipsSettlement: true,
    isIssuer: false,
    isActive: true,
  });
  const [reserveForm, setReserveForm] = useState(buildAccountState('RESERVE'));
  const [bipsForm, setBipsForm] = useState(buildAccountState('BIPS_SETTLEMENT'));

  const reserveAccount = useMemo(
    () => bank?.accounts?.find((account) => account.accountType === 'RESERVE' && account.isPrimary) || bank?.accounts?.find((account) => account.accountType === 'RESERVE') || null,
    [bank],
  );
  const bipsAccount = useMemo(
    () => bank?.accounts?.find((account) => account.accountType === 'BIPS_SETTLEMENT' && account.isPrimary) || bank?.accounts?.find((account) => account.accountType === 'BIPS_SETTLEMENT') || null,
    [bank],
  );

  const applyBankState = useCallback((record) => {
    setBank(record);
    setProfileForm({
      name: record.name || '',
      binNumber: record.binNumber || '',
      panNumber: record.panNumber || '',
      treasuryWalletAddress: record.treasuryWalletAddress || '',
      supportsBtn: Boolean(record.supportsBtn),
      supportsBipsSettlement: Boolean(record.supportsBipsSettlement),
      isIssuer: Boolean(record.isIssuer),
      isActive: Boolean(record.isActive),
    });
    const nextReserve = record.accounts?.find((account) => account.accountType === 'RESERVE' && account.isPrimary)
      || record.accounts?.find((account) => account.accountType === 'RESERVE')
      || null;
    const nextBips = record.accounts?.find((account) => account.accountType === 'BIPS_SETTLEMENT' && account.isPrimary)
      || record.accounts?.find((account) => account.accountType === 'BIPS_SETTLEMENT')
      || null;
    setReserveForm(buildAccountState('RESERVE', nextReserve));
    setBipsForm(buildAccountState('BIPS_SETTLEMENT', nextBips));
  }, []);

  const loadBank = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [bankResponse, solanaStatusResponse] = await Promise.all([
        banksApi.getById(id),
        solanaAdminApi.getConfigStatus(),
      ]);
      applyBankState(bankResponse.data);
      setSolanaStatus(solanaStatusResponse.data);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load bank details.');
    } finally {
      setLoading(false);
    }
  }, [applyBankState, id]);

  useEffect(() => {
    loadBank();
  }, [loadBank]);

  const tokenColumns = useMemo(() => [
    {
      key: 'mintAddress',
      label: 'Mint',
      render: (row) => truncateMiddle(row.mintAddress, 8, 6),
    },
    {
      key: 'treasuryWalletAddress',
      label: 'Bank Treasury Owner Wallet',
      render: (row) => truncateMiddle(row.treasuryWalletAddress, 8, 6),
    },
    {
      key: 'tokenAccountAddress',
      label: 'Token Account',
      render: (row) => truncateMiddle(row.tokenAccountAddress, 8, 6),
    },
    {
      key: 'isPrimary',
      label: 'Primary',
      render: (row) => <Badge tone={row.isPrimary ? 'blue' : 'slate'}>{row.isPrimary ? 'Primary' : 'Standard'}</Badge>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => <Badge tone={row.isActive ? 'emerald' : 'slate'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
  ], []);

  const treasuryWalletOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    const pushOption = (value, label) => {
      const normalized = String(value || '').trim();
      if (!normalized || seen.has(normalized)) {
        return;
      }

      seen.add(normalized);
      options.push({ value: normalized, label });
    };

    if (walletConnected && connectedWalletAddress) {
      pushOption(
        connectedWalletAddress,
        `Connected wallet • ${truncateMiddle(connectedWalletAddress, 8, 6)}`,
      );
    }

    if (bank?.treasuryWalletAddress) {
      pushOption(
        bank.treasuryWalletAddress,
        `Saved treasury wallet • ${truncateMiddle(bank.treasuryWalletAddress, 8, 6)}`,
      );
    }

    (solanaStatus?.onChain?.treasuryAccountDetails || []).forEach((treasuryAccount) => {
      if (treasuryAccount.ownerAddress) {
        pushOption(
          treasuryAccount.ownerAddress,
          `Owner of registered treasury account • ${truncateMiddle(treasuryAccount.ownerAddress, 8, 6)}`,
        );
      }
    });

    (bank?.tokenAccounts || []).forEach((tokenAccount) => {
      if (tokenAccount.treasuryWalletAddress) {
        pushOption(
          tokenAccount.treasuryWalletAddress,
          `Treasury from bank token account • ${truncateMiddle(tokenAccount.treasuryWalletAddress, 8, 6)}`,
        );
      }
    });

    return options;
  }, [bank, connectedWalletAddress, solanaStatus, walletConnected]);

  const treasuryWalletSelectValue = useMemo(() => {
    if (!profileForm.treasuryWalletAddress) {
      return '';
    }

    const matchedWallet = treasuryWalletOptions.find((wallet) => wallet.value === profileForm.treasuryWalletAddress);
    return matchedWallet ? matchedWallet.value : '__custom__';
  }, [profileForm.treasuryWalletAddress, treasuryWalletOptions]);

  if (loading) {
    return <LoadingScreen message="Loading bank details..." />;
  }

  if (error && !bank) {
    return <ErrorState description={error} onAction={loadBank} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle={`Manage issuer flags, reserve and BIPS accounts, the bank treasury owner wallet, and BTN treasury token accounts for ${bank.name}.`}
        title="Bank Details"
      />

      <Card>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">{bank.name}</h2>
              <p className="mt-1 text-sm text-zinc-400">Code {bank.code} · Configure bank capability and issuer state.</p>
            </div>
            <Badge tone={bank.isIssuer ? 'amber' : 'slate'}>{bank.isIssuer ? 'Issuer' : 'Standard Bank'}</Badge>
            <Badge tone={bank.supportsBtn ? 'emerald' : 'slate'}>{bank.supportsBtn ? 'BTN Enabled' : 'BTN Disabled'}</Badge>
            <Badge tone={bank.supportsBipsSettlement ? 'blue' : 'slate'}>{bank.supportsBipsSettlement ? 'BIPS Enabled' : 'BIPS Disabled'}</Badge>
          </div>

          <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
            <p className="text-sm font-medium text-sky-100">Treasury setup</p>
            <p className="mt-1 text-sm text-sky-50/85">
              First select the bank treasury owner wallet. After a mint is created, the system derives and saves the treasury token account for that wallet and mint automatically.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">Bank Name</span>
              <Input onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} value={profileForm.name} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">BIN Number</span>
              <Input onChange={(event) => setProfileForm((current) => ({ ...current, binNumber: event.target.value }))} value={profileForm.binNumber} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">PAN Number</span>
              <Input onChange={(event) => setProfileForm((current) => ({ ...current, panNumber: event.target.value }))} value={profileForm.panNumber} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">Bank Treasury Owner Wallet</span>
              <Select
                onChange={(event) => {
                  if (event.target.value === '__custom__') {
                    return;
                  }

                  setProfileForm((current) => ({ ...current, treasuryWalletAddress: event.target.value }));
                }}
                value={treasuryWalletSelectValue}
              >
                <option value="">Select a bank treasury owner wallet</option>
                {treasuryWalletOptions.map((wallet) => (
                  <option key={wallet.value} value={wallet.value}>
                    {wallet.label}
                  </option>
                ))}
                {treasuryWalletSelectValue === '__custom__' ? (
                  <option value="__custom__">Current saved wallet not in treasury options</option>
                ) : null}
              </Select>
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs text-zinc-400">Selected bank treasury owner wallet address</span>
              <Input
                onChange={(event) => setProfileForm((current) => ({ ...current, treasuryWalletAddress: event.target.value }))}
                placeholder="Bank-owned treasury wallet that will own auto-provisioned BTN token accounts"
                value={profileForm.treasuryWalletAddress}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">BTN Support</span>
              <Select
                onChange={(event) => setProfileForm((current) => ({ ...current, supportsBtn: event.target.value === 'true' }))}
                value={String(profileForm.supportsBtn)}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </Select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">BIPS Support</span>
              <Select
                onChange={(event) => setProfileForm((current) => ({ ...current, supportsBipsSettlement: event.target.value === 'true' }))}
                value={String(profileForm.supportsBipsSettlement)}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </Select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">Issuer</span>
              <Select
                onChange={(event) => setProfileForm((current) => ({ ...current, isIssuer: event.target.value === 'true' }))}
                value={String(profileForm.isIssuer)}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </Select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">Status</span>
              <Select
                onChange={(event) => setProfileForm((current) => ({ ...current, isActive: event.target.value === 'true' }))}
                value={String(profileForm.isActive)}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </label>
          </div>

          <div className="flex justify-end">
            <Button
              disabled={savingProfile}
              onClick={async () => {
                try {
                  setSavingProfile(true);
                  const response = await banksApi.update(id, {
                    ...profileForm,
                    binNumber: profileForm.binNumber || null,
                    panNumber: profileForm.panNumber || null,
                    treasuryWalletAddress: profileForm.treasuryWalletAddress || null,
                  });
                  applyBankState(response.data);
                  enqueueSnackbar('Bank profile updated', { variant: 'success' });
                } catch (saveError) {
                  enqueueSnackbar(getErrorMessage(saveError, 'Unable to update bank profile'), { variant: 'error' });
                } finally {
                  setSavingProfile(false);
                }
              }}
            >
              {savingProfile ? 'Saving...' : 'Save Bank Profile'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Reserve Account</h2>
              <p className="mt-1 text-sm text-zinc-400">Primary fiat-backed reserve account for DK issuer support or bank reserve tracking.</p>
            </div>
            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">Account Name</span>
                <Input onChange={(event) => setReserveForm((current) => ({ ...current, accountName: event.target.value }))} value={reserveForm.accountName} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">Account Number</span>
                <Input onChange={(event) => setReserveForm((current) => ({ ...current, accountNumber: event.target.value }))} value={reserveForm.accountNumber} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">Currency</span>
                <Input onChange={(event) => setReserveForm((current) => ({ ...current, currency: event.target.value }))} value={reserveForm.currency} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">Status</span>
                <Select onChange={(event) => setReserveForm((current) => ({ ...current, isActive: event.target.value === 'true' }))} value={String(reserveForm.isActive)}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </label>
            </div>
            <div className="flex justify-end">
              <Button
                disabled={savingReserve}
                onClick={async () => {
                  try {
                    setSavingReserve(true);
                    const payload = {
                      ...reserveForm,
                      remarks: reserveForm.remarks || null,
                    };
                    const response = reserveAccount
                      ? await banksApi.updateAccount(id, reserveAccount.id, payload)
                      : await banksApi.createAccount(id, payload);
                    applyBankState(response.data);
                    enqueueSnackbar(`Reserve account ${reserveAccount ? 'updated' : 'created'}`, { variant: 'success' });
                  } catch (saveError) {
                    enqueueSnackbar(getErrorMessage(saveError, 'Unable to save reserve account'), { variant: 'error' });
                  } finally {
                    setSavingReserve(false);
                  }
                }}
              >
                {savingReserve ? 'Saving...' : reserveAccount ? 'Update Reserve Account' : 'Create Reserve Account'}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">BIPS Settlement Account</h2>
              <p className="mt-1 text-sm text-zinc-400">Operational settlement account used for fiat fallback through the BIPS adapter.</p>
            </div>
            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">Account Name</span>
                <Input onChange={(event) => setBipsForm((current) => ({ ...current, accountName: event.target.value }))} value={bipsForm.accountName} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">Account Number</span>
                <Input onChange={(event) => setBipsForm((current) => ({ ...current, accountNumber: event.target.value }))} value={bipsForm.accountNumber} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">Currency</span>
                <Input onChange={(event) => setBipsForm((current) => ({ ...current, currency: event.target.value }))} value={bipsForm.currency} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">Status</span>
                <Select onChange={(event) => setBipsForm((current) => ({ ...current, isActive: event.target.value === 'true' }))} value={String(bipsForm.isActive)}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </label>
            </div>
            <div className="flex justify-end">
              <Button
                disabled={savingBips}
                onClick={async () => {
                  try {
                    setSavingBips(true);
                    const payload = {
                      ...bipsForm,
                      remarks: bipsForm.remarks || null,
                    };
                    const response = bipsAccount
                      ? await banksApi.updateAccount(id, bipsAccount.id, payload)
                      : await banksApi.createAccount(id, payload);
                    applyBankState(response.data);
                    enqueueSnackbar(`BIPS account ${bipsAccount ? 'updated' : 'created'}`, { variant: 'success' });
                  } catch (saveError) {
                    enqueueSnackbar(getErrorMessage(saveError, 'Unable to save BIPS account'), { variant: 'error' });
                  } finally {
                    setSavingBips(false);
                  }
                }}
              >
                {savingBips ? 'Saving...' : bipsAccount ? 'Update BIPS Account' : 'Create BIPS Account'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white">BTN Treasury Token Accounts</h2>
            <p className="mt-1 text-sm text-zinc-400">Review the treasury token accounts created automatically for each supported BTN mint.</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4">
            <p className="text-sm text-zinc-300">
              One bank treasury owner wallet can have one treasury token account per mint. The wallet is the owner. The treasury token account is where the tokens actually sit. These rows are auto-provisioned during mint creation and shown here for reference.
            </p>
          </div>

          <AppTable
            columns={tokenColumns}
            emptyDescription="No BTN treasury token accounts have been registered for this bank yet."
            emptyTitle="No token accounts"
            error=""
            loading={false}
            minWidth={760}
            rows={bank.tokenAccounts || []}
          />
        </div>
      </Card>
    </div>
  );
}

export default BankDetailsPage;
