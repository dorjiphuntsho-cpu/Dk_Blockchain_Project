import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import usePortalAuth from '../../hooks/usePortalAuth';
import usePortalAuthStore from '../../modules/portal/portalAuth.store';
import { portalApi } from '../../modules/portal/portal.api';
import { getErrorMessage } from '../../utils/error';

function createEmptyAccount(banks = []) {
  return {
    bankId: banks[0]?.id || '',
    accountNumber: '',
    accountName: '',
    isPrimary: false,
  };
}

function PortalBankAccountsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { token, customer } = usePortalAuth();
  const setCustomer = usePortalAuthStore((state) => state.setCustomer);
  const [banks, setBanks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);

      try {
        const [banksResponse, summaryResponse] = await Promise.all([
          portalApi.getBankOptions(token),
          portalApi.getSummary(token),
        ]);

        if (!isMounted) {
          return;
        }

        const nextBanks = banksResponse.data || [];
        const existingAccounts = summaryResponse.data?.customer?.linkedBankAccounts || customer?.linkedBankAccounts || [];
        setBanks(nextBanks);
        setAccounts(
          existingAccounts.length
            ? existingAccounts.map((account, index) => ({
              bankId: account.bankId || nextBanks[0]?.id || '',
              accountNumber: account.accountNumber || '',
              accountName: account.accountName || '',
              isPrimary: account.isPrimary === true || index === 0,
            }))
            : [createEmptyAccount(nextBanks)],
        );
      } catch (error) {
        if (isMounted) {
          enqueueSnackbar(getErrorMessage(error, 'Unable to load customer bank accounts'), { variant: 'error' });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (token) {
      load();
    }

    return () => {
      isMounted = false;
    };
  }, [customer?.linkedBankAccounts, enqueueSnackbar, token]);

  const updateAccount = (index, field, value) => {
    setAccounts((current) => current.map((account, accountIndex) => {
      if (accountIndex !== index) {
        return field === 'isPrimary' && value ? { ...account, isPrimary: false } : account;
      }

      return {
        ...account,
        [field]: value,
        ...(field === 'isPrimary' && value ? { isPrimary: true } : {}),
      };
    }));
  };

  const addAccount = () => {
    setAccounts((current) => [...current, createEmptyAccount(banks)]);
  };

  const removeAccount = (index) => {
    setAccounts((current) => {
      const next = current.filter((_, accountIndex) => accountIndex !== index);
      if (next.length === 0) {
        return [createEmptyAccount(banks)];
      }
      if (!next.some((account) => account.isPrimary)) {
        next[0].isPrimary = true;
      }
      return [...next];
    });
  };

  const handleSave = async () => {
    const cleanedAccounts = accounts
      .map((account, index) => ({
        bankId: account.bankId,
        accountNumber: String(account.accountNumber || '').trim(),
        accountName: String(account.accountName || '').trim(),
        isPrimary: account.isPrimary || index === 0,
      }))
      .filter((account) => account.bankId && account.accountNumber);

    if (!cleanedAccounts.length) {
      enqueueSnackbar('Add at least one bank account before saving', { variant: 'warning' });
      return;
    }

    setIsSaving(true);

    try {
      const response = await portalApi.updateBankAccounts(token, { accounts: cleanedAccounts });
      setCustomer(response.data);
      window.dispatchEvent(new CustomEvent('portal-summary-refresh'));
      enqueueSnackbar('Linked bank accounts updated', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, 'Unable to update linked bank accounts'), { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Card className="border-white/8 bg-[#14151A]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="fintech-label text-[#F0B90B]">Customer bank accounts</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Manage payout and funding accounts</h2>
            <p className="mt-2 max-w-2xl text-sm text-[#848E9C]">
              Add multiple customer bank accounts and choose the bank from existing records so bank codes stay consistent.
            </p>
          </div>
          <Button disabled={isLoading || isSaving} onClick={addAccount} variant="secondary">
            <PlusIcon className="size-4" />
            Add account
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          {accounts.map((account, index) => (
            <div className="grid gap-4 rounded-xl border border-white/8 bg-[#1B1F24] p-3 md:grid-cols-[1.2fr_1fr_1fr_auto]" key={`${account.bankId}-${index}-${account.accountNumber}`}>
              <div className="grid gap-2">
                <span className="text-sm font-medium text-zinc-200">Bank</span>
                <Select disabled={isLoading || isSaving} name={`bank-${index}`} onChange={(event) => updateAccount(index, 'bankId', event.target.value)} value={account.bankId}>
                  {banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>{`${bank.name} (${bank.code})`}</option>
                  ))}
                </Select>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-zinc-200">Account number</span>
                <Input disabled={isLoading || isSaving} onChange={(event) => updateAccount(index, 'accountNumber', event.target.value)} value={account.accountNumber} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-zinc-200">Account name</span>
                <Input disabled={isLoading || isSaving} onChange={(event) => updateAccount(index, 'accountName', event.target.value)} value={account.accountName} />
              </label>
              <div className="flex items-end gap-2">
                <Button className="w-full md:w-auto" disabled={isLoading || isSaving} onClick={() => updateAccount(index, 'isPrimary', true)} variant={account.isPrimary ? 'primary' : 'outline'}>
                  {account.isPrimary ? 'Primary' : 'Make primary'}
                </Button>
                <Button disabled={isLoading || isSaving || accounts.length === 1} onClick={() => removeAccount(index)} variant="danger">
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Button disabled={isLoading || isSaving} onClick={handleSave} variant="secondary">
            {isSaving ? 'Saving...' : 'Save bank accounts'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default PortalBankAccountsPage;
