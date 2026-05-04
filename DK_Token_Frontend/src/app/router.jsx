import { createBrowserRouter, Navigate } from 'react-router-dom';

import ProtectedRoute from '../components/auth/ProtectedRoute';
import PortalProtectedRoute from '../components/auth/PortalProtectedRoute';
import RoleGuard from '../components/auth/RoleGuard';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import PortalAuthLayout from '../layouts/PortalAuthLayout';
import PortalLayout from '../layouts/PortalLayout';
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import PortalActionPage from '../pages/portal/PortalActionPage';
import PortalHomePage from '../pages/portal/PortalHomePage';
import PortalLoginPage from '../pages/portal/PortalLoginPage';
import UsersPage from '../pages/users/UsersPage';
import UserCreatePage from '../pages/users/UserCreatePage';
import UserDetailsPage from '../pages/users/UserDetailsPage';
import WalletsPage from '../pages/wallets/WalletsPage';
import WalletCreatePage from '../pages/wallets/WalletCreatePage';
import WalletDetailsPage from '../pages/wallets/WalletDetailsPage';
import MyWalletsPage from '../pages/wallets/MyWalletsPage';
import BanksPage from '../pages/banks/BanksPage';
import BankDetailsPage from '../pages/banks/BankDetailsPage';
import ReservesPage from '../pages/reserves/ReservesPage';
import ReserveDetailsPage from '../pages/reserves/ReserveDetailsPage';
import SettlementsPage from '../pages/settlements/SettlementsPage';
import SettlementCreatePage from '../pages/settlements/SettlementCreatePage';
import SettlementDetailsPage from '../pages/settlements/SettlementDetailsPage';
import TokenRequestsPage from '../pages/tokenRequests/TokenRequestsPage';
import TokenRequestCreatePage from '../pages/tokenRequests/TokenRequestCreatePage';
import TokenRequestDetailsPage from '../pages/tokenRequests/TokenRequestDetailsPage';
import MyTokenRequestsPage from '../pages/tokenRequests/MyTokenRequestsPage';
import PendingApprovalsPage from '../pages/tokenRequests/PendingApprovalsPage';
import AuditLogsPage from '../pages/auditLogs/AuditLogsPage';
import SolanaAdminPage from '../pages/solana/SolanaAdminPage';
import ManagedTokensPage from '../pages/solana/ManagedTokensPage';
import NotFoundPage from '../pages/notFound/NotFoundPage';
import { ROLES } from '../utils/constants';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate replace to="/portal/login" />,
  },
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: '/portal/login',
    element: <PortalAuthLayout />,
    children: [{ index: true, element: <PortalLoginPage /> }],
  },
  {
    path: '/portal',
    element: <PortalProtectedRoute />,
    children: [
      {
        element: <PortalLayout />,
        children: [
          { index: true, element: <Navigate replace to="/portal/overview" /> },
          { path: 'overview', element: <PortalHomePage /> },
          { path: 'buy', element: <PortalActionPage mode="buy" /> },
          { path: 'sell', element: <PortalActionPage mode="sell" /> },
          { path: 'redeem', element: <PortalActionPage mode="redeem" /> },
          { path: 'transfer', element: <PortalActionPage mode="transfer" /> },
        ],
      },
    ],
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
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
              { path: 'banks', element: <BanksPage /> },
              { path: 'banks/:id', element: <BankDetailsPage /> },
              { path: 'solana-admin', element: <SolanaAdminPage /> },
              { path: 'managed-tokens', element: <ManagedTokensPage /> },
              { path: 'token-requests', element: <TokenRequestsPage /> },
              { path: 'audit-logs', element: <AuditLogsPage /> },
            ],
          },
          {
            element: <RoleGuard roles={[ROLES.ADMIN, ROLES.MAKER, ROLES.CHECKER, ROLES.EXECUTOR]} />,
            children: [
              { path: 'reserves', element: <ReservesPage /> },
              { path: 'settlements', element: <SettlementsPage /> },
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
            element: <RoleGuard roles={[ROLES.ADMIN, ROLES.MAKER]} />,
            children: [
              { path: 'settlements/new', element: <SettlementCreatePage /> },
            ],
          },
          {
            element: <RoleGuard roles={[ROLES.CHECKER]} />,
            children: [{ path: 'pending-approvals', element: <PendingApprovalsPage /> }],
          },
          {
            path: 'token-requests/:id',
            element: <TokenRequestDetailsPage />,
          },
          {
            path: 'reserves/:id',
            element: <ReserveDetailsPage />,
          },
          {
            path: 'settlements/:id',
            element: <SettlementDetailsPage />,
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
