import { Navigate, Outlet, useLocation } from 'react-router-dom';

import useAuth from '../../hooks/useAuth';
import LoadingScreen from '../common/LoadingScreen';

function ProtectedRoute() {
  const { isLoading, token, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Preparing your workspace..." />;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
