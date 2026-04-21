import { Navigate, Outlet } from 'react-router-dom';

import useAuth from '../../hooks/useAuth';
import { hasRole } from '../../utils/permissions';

function RoleGuard({ roles = [] }) {
  const { user } = useAuth();

  if (!hasRole(user, roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default RoleGuard;
