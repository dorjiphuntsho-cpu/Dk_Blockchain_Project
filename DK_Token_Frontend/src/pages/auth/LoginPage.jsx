import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { FormProvider, useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import FormTextField from '../../components/form/FormTextField';
import useAuth from '../../hooks/useAuth';
import { loginSchema } from '../../modules/auth/auth.schemas';

function LoginPage() {
  const methods = useForm({
    defaultValues: {
      email: 'admin@example.com',
      password: 'Admin@123',
    },
    resolver: zodResolver(loginSchema),
  });
  const { login, isLoading } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState('');

  const handleSubmit = methods.handleSubmit(async (values) => {
    try {
      setFormError('');
      await login(values);
      enqueueSnackbar('Login successful', { variant: 'success' });
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (error) {
      setFormError(error.message || 'Unable to login');
    }
  });

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4">Token Management Admin Portal</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Sign in to manage off-chain token workflows, approvals, and execution readiness.
        </Typography>
      </Box>
      <Alert severity="info">
        Mock credentials: `admin@example.com`, `maker@example.com`, `checker@example.com`, `executor@example.com`
        with passwords `Admin@123`, `Maker@123`, `Checker@123`, `Executor@123`.
      </Alert>
      {formError ? <Alert severity="error">{formError}</Alert> : null}
      <FormProvider {...methods}>
        <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
          <FormTextField label="Email" name="email" />
          <FormTextField label="Password" name="password" type="password" />
          <Button disabled={isLoading} size="large" type="submit" variant="contained">
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </Stack>
      </FormProvider>
    </Stack>
  );
}

export default LoginPage;
