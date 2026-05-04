import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import FormTextField from '../../components/form/FormTextField';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import usePortalAuth from '../../hooks/usePortalAuth';
import { portalLoginSchema } from '../../modules/portal/portal.schemas';
import { getErrorMessage } from '../../utils/error';

function PortalLoginPage() {
  const methods = useForm({
    defaultValues: {
      cid: '',
      mpin: '',
    },
    resolver: zodResolver(portalLoginSchema),
  });
  const { login, isLoading } = usePortalAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const [formError, setFormError] = useState('');

  const handleSubmit = methods.handleSubmit(async (values) => {
    try {
      setFormError('');
      await login(values);
      enqueueSnackbar('Customer portal access granted', { variant: 'success' });
      navigate(location.state?.from?.pathname || '/portal/overview', { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error, 'Unable to sign in to BTN portal'));
    }
  });

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Customer Sign-in</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Access your BTN wallet journey</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          Sign in using your CID and DK Bank MPIN. This portal is isolated from internal dashboards and designed for retail customer actions only.
        </p>
      </div>

      {formError ? (
        <div className="mb-4">
          <Alert tone="error">{formError}</Alert>
        </div>
      ) : null}

      <Alert tone="info">
        Sign in using one of the registered customer CID and MPIN pairs seeded in the backend.
      </Alert>

      <FormProvider {...methods}>
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <FormTextField label="Citizen ID Number" name="cid" placeholder="11101001234" />
          <FormTextField label="DK Bank MPIN" name="mpin" placeholder="Enter 4 to 6 digit MPIN" type="password" />

          <Button className="w-full" disabled={isLoading} size="lg" type="submit">
            {isLoading ? 'Signing in...' : 'Enter Portal'}
          </Button>
        </form>
      </FormProvider>

      <div className="mt-6 text-center text-sm text-zinc-500">
        Need internal operations access?{' '}
        <Link className="font-medium text-emerald-300 hover:text-emerald-200" to="/login">
          Go to admin sign-in
        </Link>
      </div>
    </div>
  );
}

export default PortalLoginPage;
