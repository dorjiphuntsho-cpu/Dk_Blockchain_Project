import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, CardContent, MenuItem, Stack, Typography } from '@mui/material';
import { FormProvider, useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import FormTextField from '../../components/form/FormTextField';
import { usersApi } from '../../modules/users/users.api';
import { walletsApi } from '../../modules/wallets/wallets.api';
import { walletSchema } from '../../modules/wallets/wallets.schemas';

function WalletDetailsPage() {
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const methods = useForm({
    defaultValues: {
      userId: '',
      walletAddress: '',
      label: '',
      isPrimary: false,
    },
    resolver: zodResolver(walletSchema),
  });

  async function loadWallet() {
    setLoading(true);
    const [walletResponse, usersResponse] = await Promise.all([
      walletsApi.getById(id),
      usersApi.list({ page: 1, limit: 100 }),
    ]);

    const wallet = walletResponse.data;
    methods.reset({
      userId: wallet.userId,
      walletAddress: wallet.walletAddress,
      label: wallet.label || '',
      isPrimary: wallet.isPrimary,
    });
    setUsers(usersResponse.data.items);
    setLoading(false);
  }

  useEffect(() => {
    loadWallet();
  }, [id]);

  const handleSubmit = methods.handleSubmit(async (values) => {
    await walletsApi.update(id, {
      ...values,
      isPrimary: values.isPrimary === true || values.isPrimary === 'true',
    });
    enqueueSnackbar('Wallet updated successfully', { variant: 'success' });
    loadWallet();
  });

  if (loading) {
    return <LoadingScreen message="Loading wallet details..." />;
  }

  return (
    <Stack spacing={3}>
      <PageHeader subtitle="Review wallet status and update wallet details." title="Wallet Details" />
      <Card>
        <CardContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Update wallet metadata, user assignment, and primary status.
          </Typography>
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
                <Button
                  color="warning"
                  onClick={async () => {
                    const wallet = methods.getValues();
                    await walletsApi.updateStatus(id, false);
                    enqueueSnackbar('Wallet deactivated', { variant: 'success' });
                    loadWallet();
                  }}
                  variant="outlined"
                >
                  Deactivate
                </Button>
                <Button type="submit" variant="contained">Save Changes</Button>
              </Stack>
            </Stack>
          </FormProvider>
        </CardContent>
      </Card>
    </Stack>
  );
}

export default WalletDetailsPage;
