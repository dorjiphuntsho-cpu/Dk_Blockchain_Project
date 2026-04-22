import { createBrowserRouter, Navigate } from 'react-router-dom';

import ProtectedRoute from '../components/auth/ProtectedRoute';
import RoleGuard from '../components/auth/RoleGuard';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import UsersPage from '../pages/users/UsersPage';
import UserCreatePage from '../pages/users/UserCreatePage';
import UserDetailsPage from '../pages/users/UserDetailsPage';
import WalletsPage from '../pages/wallets/WalletsPage';
import WalletCreatePage from '../pages/wallets/WalletCreatePage';
import WalletDetailsPage from '../pages/wallets/WalletDetailsPage';
import MyWalletsPage from '../pages/wallets/MyWalletsPage';
import TokenRequestsPage from '../pages/tokenRequests/TokenRequestsPage';
import TokenRequestCreatePage from '../pages/tokenRequests/TokenRequestCreatePage';
import TokenRequestDetailsPage from '../pages/tokenRequests/TokenRequestDetailsPage';
import MyTokenRequestsPage from '../pages/tokenRequests/MyTokenRequestsPage';
import PendingApprovalsPage from '../pages/tokenRequests/PendingApprovalsPage';
import ReadyForExecutionPage from '../pages/tokenRequests/ReadyForExecutionPage';
import AuditLogsPage from '../pages/auditLogs/AuditLogsPage';
import SolanaAdminPage from '../pages/solana/SolanaAdminPage';
import ManagedTokensPage from '../pages/solana/ManagedTokensPage';
import NotFoundPage from '../pages/notFound/NotFoundPage';
import { ROLES } from '../utils/constants';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Navigate replace to="/dashboard" /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'my-wallets', element: <MyWalletsPage /> },
          {
            element: <RoleGuard roles={[ROLES.ADMIN]} />,
            children: [
              { path: 'users', element: <UsersPage /> },
              { path: 'users/new', element: <UserCreatePage /> },
              { path: 'users/:id', element: <UserDetailsPage /> },
              { path: 'wallets', element: <WalletsPage /> },
              { path: 'wallets/new', element: <WalletCreatePage /> },
              { path: 'wallets/:id', element: <WalletDetailsPage /> },
              { path: 'solana-admin', element: <SolanaAdminPage /> },
              { path: 'managed-tokens', element: <ManagedTokensPage /> },
              { path: 'token-requests', element: <TokenRequestsPage /> },
              { path: 'audit-logs', element: <AuditLogsPage /> },
            ],
          },
          {
            element: <RoleGuard roles={[ROLES.MAKER]} />,
            children: [
              { path: 'token-requests/new', element: <TokenRequestCreatePage /> },
              { path: 'my-requests', element: <MyTokenRequestsPage /> },
            ],
          },
          {
            element: <RoleGuard roles={[ROLES.CHECKER]} />,
            children: [{ path: 'pending-approvals', element: <PendingApprovalsPage /> }],
          },
          {
            element: <RoleGuard roles={[ROLES.ADMIN, ROLES.EXECUTOR]} />,
            children: [{ path: 'ready-for-execution', element: <ReadyForExecutionPage /> }],
          },
          {
            path: 'token-requests/:id',
            element: <TokenRequestDetailsPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export default router;
