import { zodResolver } from '@hookform/resolvers/zod';
import { Button, MenuItem, Stack } from '@mui/material';
import { FormProvider, useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import PageHeader from '../../components/common/PageHeader';
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
    <Stack spacing={3}>
      <PageHeader subtitle="Register a wallet and assign it to a user." title="Create Wallet" />
      <FormProvider {...methods}>
        <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
          <FormTextField label="User" name="userId" select>
            {users.map((user) => (
              <MenuItem key={user.id} value={user.id}>{user.fullName}</MenuItem>
            ))}
          </FormTextField>
          <FormTextField label="Wallet Address" name="walletAddress" />
          <FormTextField label="Label" name="label" />
          <FormTextField label="Is Primary" name="isPrimary" select>
            <MenuItem value={false}>No</MenuItem>
            <MenuItem value={true}>Yes</MenuItem>
          </FormTextField>
          <Stack direction="row" spacing={1.5}>
            <Button disabled={submitting} onClick={() => navigate('/wallets')} variant="outlined">Cancel</Button>
            <Button disabled={submitting} type="submit" variant="contained">
              {submitting ? 'Creating...' : 'Create Wallet'}
            </Button>
          </Stack>
        </Stack>
      </FormProvider>
    </Stack>
  );
}

export default WalletCreatePage;
