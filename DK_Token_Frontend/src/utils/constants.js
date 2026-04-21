export const ROLES = {
  ADMIN: 'ADMIN',
  MAKER: 'MAKER',
  CHECKER: 'CHECKER',
  EXECUTOR: 'EXECUTOR',
};

export const REQUEST_TYPES = {
  MINT: 'MINT',
  TRANSFER: 'TRANSFER',
  BURN: 'BURN',
};

export const REQUEST_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  READY_FOR_EXECUTION: 'READY_FOR_EXECUTION',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED',
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
export const ENABLE_MOCK_API = String(import.meta.env.VITE_ENABLE_MOCK_API ?? 'true') === 'true';

export const ROLE_OPTIONS = Object.values(ROLES).map((role) => ({
  label: role,
  value: role,
}));

export const REQUEST_TYPE_OPTIONS = Object.values(REQUEST_TYPES).map((type) => ({
  label: type,
  value: type,
}));

export const REQUEST_STATUS_OPTIONS = Object.values(REQUEST_STATUSES).map((status) => ({
  label: status.replaceAll('_', ' '),
  value: status,
}));

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', roles: Object.values(ROLES), section: 'Overview', icon: 'dashboard' },
  { label: 'Token Requests', path: '/token-requests', roles: [ROLES.ADMIN], section: 'Operations', icon: 'request' },
  { label: 'My Requests', path: '/my-requests', roles: [ROLES.MAKER], section: 'Operations', icon: 'myRequests' },
  { label: 'Pending Approvals', path: '/pending-approvals', roles: [ROLES.CHECKER], section: 'Operations', icon: 'approvals' },
  { label: 'Ready for Execution', path: '/ready-for-execution', roles: [ROLES.ADMIN, ROLES.EXECUTOR], section: 'Operations', icon: 'execution' },
  { label: 'Users', path: '/users', roles: [ROLES.ADMIN], section: 'Admin', icon: 'users' },
  { label: 'Wallets', path: '/wallets', roles: [ROLES.ADMIN], section: 'Admin', icon: 'wallets' },
  { label: 'Audit Logs', path: '/audit-logs', roles: [ROLES.ADMIN], section: 'Logs', icon: 'logs' },
];

export const NAV_PREFIX_MATCHES = ['/users/', '/wallets/', '/token-requests/'];

export const ROUTE_TITLES = {
  '/dashboard': 'Dashboard',
  '/users': 'Users',
  '/users/new': 'Create User',
  '/wallets': 'Wallets',
  '/wallets/new': 'Create Wallet',
  '/token-requests': 'Token Requests',
  '/token-requests/new': 'Create Token Request',
  '/my-requests': 'My Token Requests',
  '/pending-approvals': 'Pending Approvals',
  '/ready-for-execution': 'Ready for Execution',
  '/audit-logs': 'Audit Logs',
  '/login': 'Login',
};

export const ENTITY_TYPES = {
  USER: 'USER',
  ROLE_ASSIGNMENT: 'ROLE_ASSIGNMENT',
  WALLET: 'WALLET',
  TOKEN_REQUEST: 'TOKEN_REQUEST',
};

export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  MARK_READY: 'MARK_READY',
  RECORD_EXECUTION: 'RECORD_EXECUTION',
  STATUS_CHANGE: 'STATUS_CHANGE',
  ASSIGN_ROLE: 'ASSIGN_ROLE',
};
