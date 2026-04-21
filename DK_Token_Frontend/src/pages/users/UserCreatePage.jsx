import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Stack } from '@mui/material';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import PageHeader from '../../components/common/PageHeader';
import FormAutocomplete from '../../components/form/FormAutocomplete';
import FormTextField from '../../components/form/FormTextField';
import { usersApi } from '../../modules/users/users.api';
import { userCreateSchema } from '../../modules/users/users.schemas';
import { ROLE_OPTIONS } from '../../utils/constants';

function UserCreatePage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const methods = useForm({
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      roles: [],
    },
    resolver: zodResolver(userCreateSchema),
  });

  const handleSubmit = methods.handleSubmit(async (values) => {
    const response = await usersApi.create({
      ...values,
      roles: values.roles.map((role) => role.value),
    });

    enqueueSnackbar('User created successfully', { variant: 'success' });
    navigate(`/users/${response.data.id}`);
  });

  return (
    <Stack spacing={3}>
      <PageHeader subtitle="Create a new user and assign initial roles." title="Create User" />
      <FormProvider {...methods}>
        <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
          <FormTextField label="Full Name" name="fullName" />
          <FormTextField label="Email" name="email" />
          <FormTextField label="Password" name="password" type="password" />
          <FormAutocomplete label="Roles" multiple name="roles" options={ROLE_OPTIONS} />
          <Stack direction="row" spacing={1.5}>
            <Button onClick={() => navigate('/users')} variant="outlined">Cancel</Button>
            <Button type="submit" variant="contained">Create User</Button>
          </Stack>
        </Stack>
      </FormProvider>
    </Stack>
  );
}

export default UserCreatePage;
