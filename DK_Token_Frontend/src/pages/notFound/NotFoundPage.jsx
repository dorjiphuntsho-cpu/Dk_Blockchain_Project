import { useNavigate } from 'react-router-dom';

import Button from '../../components/ui/Button';

function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-3xl font-semibold text-white">Page Not Found</h1>
        <p className="text-sm text-zinc-400">
          The page you requested is not available in this admin portal.
        </p>
        <div className="pt-2">
          <Button onClick={() => navigate('/dashboard')} variant="secondary">
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
