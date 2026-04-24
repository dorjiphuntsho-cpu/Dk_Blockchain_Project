import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
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
    <div className="space-y-6">
      <PageHeader subtitle="Create a new user and assign initial roles." title="Create User" />
      <section className="max-w-2xl">
        <Card className="rounded-2xl bg-zinc-900/80">
      <FormProvider {...methods}>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-base font-semibold text-white">User details</h2>
            <p className="mt-1 text-sm text-zinc-400">Create a user account and assign the roles they need to operate in the portal.</p>
          </div>
          <FormTextField label="Full Name" name="fullName" />
          <FormTextField label="Email" name="email" />
          <FormTextField label="Password" name="password" type="password" />
          <FormAutocomplete label="Roles" multiple name="roles" options={ROLE_OPTIONS} />
          <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
            <Button onClick={() => navigate('/users')} variant="secondary">Cancel</Button>
            <Button type="submit" variant="primary">Create User</Button>
          </div>
        </form>
      </FormProvider>
        </Card>
      </section>
    </div>
  );
}

export default UserCreatePage;
