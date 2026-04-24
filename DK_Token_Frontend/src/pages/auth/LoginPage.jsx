import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import FormTextField from '../../components/form/FormTextField';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
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
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Lizard Token Portal
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Sign in to manage token operations, maker-checker approvals, wallet coordination, and on-chain execution.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-8 shadow-2xl">
        <div className="mb-6">
          <span className="inline-flex items-center rounded-md bg-zinc-900/10 px-2 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-white/10">
            Secure operations
          </span>
        </div>

        <Alert tone="info">
          Mock credentials: <span className="font-mono">admin@example.com</span>,{' '}
          <span className="font-mono">maker@example.com</span>,{' '}
          <span className="font-mono">checker@example.com</span>,{' '}
          <span className="font-mono">executor@example.com</span> with passwords{' '}
          <span className="font-mono">Admin@123</span>,{' '}
          <span className="font-mono">Maker@123</span>,{' '}
          <span className="font-mono">Checker@123</span>,{' '}
          <span className="font-mono">Executor@123</span>.
        </Alert>

        {formError ? (
          <div className="mt-4">
            <Alert tone="error">{formError}</Alert>
          </div>
        ) : null}

        <FormProvider {...methods}>
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <FormTextField label="Email" name="email" />
            <FormTextField label="Password" name="password" type="password" />

            <Button className="w-full" disabled={isLoading} size="lg" type="submit">
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

export default LoginPage;
