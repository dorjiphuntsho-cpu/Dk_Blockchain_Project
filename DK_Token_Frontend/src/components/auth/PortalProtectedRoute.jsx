import { Navigate, Outlet, useLocation } from 'react-router-dom';

import LoadingScreen from '../common/LoadingScreen';
import usePortalAuth from '../../hooks/usePortalAuth';

function PortalProtectedRoute() {
  const location = useLocation();
  const { isLoading, token, customer } = usePortalAuth();

  if (isLoading) {
    return <LoadingScreen message="Loading BTN portal..." />;
  }

  if (!token || !customer) {
    return <Navigate to="/portal/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default PortalProtectedRoute;
