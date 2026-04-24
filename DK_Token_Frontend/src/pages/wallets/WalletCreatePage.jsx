import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import FormTextField from '../../components/form/FormTextField';
import { usersApi } from '../../modules/users/users.api';
import { walletsApi } from '../../modules/wallets/wallets.api';
import { walletSchema } from '../../modules/wallets/wallets.schemas';
import { getErrorMessage } from '../../utils/error';

function WalletCreatePage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [users, setUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const methods = useForm({
    defaultValues: {
      userId: '',
      walletAddress: '',
      label: '',
      isPrimary: false,
    },
    resolver: zodResolver(walletSchema),
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await usersApi.list({ page: 1, limit: 100 });
        setUsers(response.data.items);
      } catch (loadError) {
        enqueueSnackbar(getErrorMessage(loadError, 'Unable to load users'), { variant: 'error' });
      }
    }

    loadUsers();
  }, [enqueueSnackbar]);

  const handleSubmit = methods.handleSubmit(async (values) => {
    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await walletsApi.create({
        ...values,
        isPrimary: values.isPrimary === true || values.isPrimary === 'true',
      });
      enqueueSnackbar('Wallet created successfully', { variant: 'success' });
      navigate(`/wallets/${response.data.id}`);
    } catch (createError) {
      enqueueSnackbar(getErrorMessage(createError, 'Unable to create wallet'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Register a wallet and assign it to a user." title="Create Wallet" />
      <section className="max-w-2xl">
        <Card className="rounded-2xl bg-zinc-900/80">
          <FormProvider {...methods}>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <h2 className="text-base font-semibold text-white">Wallet details</h2>
                <p className="mt-1 text-sm text-zinc-400">Assign the wallet to a user and define whether it should be their primary wallet.</p>
              </div>
              <FormTextField label="User" name="userId" select>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.fullName}</option>
            ))}
          </FormTextField>
          <FormTextField label="Wallet Address" name="walletAddress" />
          <FormTextField label="Label" name="label" />
          <FormTextField label="Is Primary" name="isPrimary" select>
            <option value={false}>No</option>
            <option value={true}>Yes</option>
          </FormTextField>
              <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
            <Button disabled={submitting} onClick={() => navigate('/wallets')} variant="secondary">Cancel</Button>
            <Button disabled={submitting} type="submit" variant="primary">
              {submitting ? 'Creating...' : 'Create Wallet'}
            </Button>
              </div>
            </form>
          </FormProvider>
        </Card>
      </section>
    </div>
  );
}

export default WalletCreatePage;
