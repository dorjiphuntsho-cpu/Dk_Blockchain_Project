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
  RESERVE_MINT: 'RESERVE_MINT',
  REPLENISHMENT_MINT: 'REPLENISHMENT_MINT',
  INTERBANK_TRANSFER: 'INTERBANK_TRANSFER',
  REDEMPTION: 'REDEMPTION',
};

export const REQUEST_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  READY_FOR_EXECUTION: 'READY_FOR_EXECUTION',
  ON_CHAIN_PENDING: 'ON_CHAIN_PENDING',
  INQUIRY_FAILED: 'INQUIRY_FAILED',
  BIPS_PENDING: 'BIPS_PENDING',
  SETTLED: 'SETTLED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED',
};

export const SETTLEMENT_MODES = {
  ON_CHAIN_BTN: 'ON_CHAIN_BTN',
  BIPS_FIAT: 'BIPS_FIAT',
};

export const ON_CHAIN_PENDING_STATUSES = [
  REQUEST_STATUSES.READY_FOR_EXECUTION,
  REQUEST_STATUSES.ON_CHAIN_PENDING,
];

export const EXECUTION_MODES = {
  SERVER_MANAGED: 'SERVER_MANAGED',
  BROWSER_WALLET: 'BROWSER_WALLET',
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
export const ENABLE_MOCK_API = String(import.meta.env.VITE_ENABLE_MOCK_API ?? 'false') === 'true';
export const SOLANA_CLUSTER = import.meta.env.VITE_SOLANA_CLUSTER || 'localnet';
export const SOLANA_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || 'http://127.0.0.1:8899';

export const ROLE_OPTIONS = Object.values(ROLES).map((role) => ({
  label: role,
  value: role,
}));

export const REQUEST_TYPE_OPTIONS = Object.values(REQUEST_TYPES).map((type) => ({
  label: type,
  value: type,
}));

export const REQUEST_STATUS_OPTIONS = [
  REQUEST_STATUSES.DRAFT,
  REQUEST_STATUSES.PENDING_APPROVAL,
  REQUEST_STATUSES.APPROVED,
  REQUEST_STATUSES.INQUIRY_FAILED,
  REQUEST_STATUSES.REJECTED,
  REQUEST_STATUSES.CANCELLED,
  REQUEST_STATUSES.BIPS_PENDING,
  REQUEST_STATUSES.SETTLED,
  REQUEST_STATUSES.MANUAL_REVIEW,
  REQUEST_STATUSES.EXECUTED,
  REQUEST_STATUSES.FAILED,
].map((status) => ({
  label: status.replaceAll('_', ' '),
  value: status,
}));

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', roles: Object.values(ROLES), section: 'Overview', icon: 'dashboard' },
  { label: 'My Wallets', path: '/my-wallets', roles: Object.values(ROLES), section: 'Overview', icon: 'wallets' },
  { label: 'My Requests', path: '/my-requests', roles: [ROLES.MAKER], section: 'Operations', icon: 'myRequests' },
  { label: 'Pending Approvals', path: '/pending-approvals', roles: [ROLES.CHECKER], section: 'Operations', icon: 'approvals' },
  { label: 'Reserves', path: '/reserves', roles: [ROLES.ADMIN, ROLES.MAKER, ROLES.CHECKER, ROLES.EXECUTOR], section: 'Operations', icon: 'request' },
  { label: 'Settlements', path: '/settlements', roles: [ROLES.ADMIN, ROLES.MAKER, ROLES.CHECKER, ROLES.EXECUTOR], section: 'Operations', icon: 'request' },
  { label: 'Solana Admin', path: '/solana-admin', roles: [ROLES.ADMIN], section: 'Admin', icon: 'solana' },
  { label: 'Banks', path: '/banks', roles: [ROLES.ADMIN], section: 'Admin', icon: 'wallets' },
  { label: 'Managed Tokens', path: '/managed-tokens', roles: [ROLES.ADMIN], section: 'Admin', icon: 'request' },
  { label: 'Users', path: '/users', roles: [ROLES.ADMIN], section: 'Admin', icon: 'users' },
  { label: 'Wallets', path: '/wallets', roles: [ROLES.ADMIN], section: 'Admin', icon: 'wallets' },
  { label: 'Audit Logs', path: '/audit-logs', roles: [ROLES.ADMIN], section: 'Logs', icon: 'logs' },
];

export const NAV_PREFIX_MATCHES = ['/users/', '/wallets/', '/banks/', '/token-requests/', '/reserves/', '/settlements/'];

export const ROUTE_TITLES = {
  '/dashboard': 'Dashboard',
  '/my-wallets': 'My Wallets',
  '/users': 'Users',
  '/users/new': 'Create User',
  '/wallets': 'Wallets',
  '/wallets/new': 'Create Wallet',
  '/banks': 'Banks',
  '/reserves': 'Reserves',
  '/token-requests': 'Token Requests',
  '/token-requests/new': 'Create Token Request',
  '/settlements': 'Settlements',
  '/settlements/new': 'Create Settlement',
  '/my-requests': 'My Token Requests',
  '/pending-approvals': 'Pending Approvals',
  '/solana-admin': 'Solana Admin',
  '/managed-tokens': 'Managed Tokens',
  '/audit-logs': 'Audit Logs',
  '/login': 'Login',
};

export const ENTITY_TYPES = {
  USER: 'USER',
  ROLE_ASSIGNMENT: 'ROLE_ASSIGNMENT',
  WALLET: 'WALLET',
  TOKEN_REQUEST: 'TOKEN_REQUEST',
  RESERVE_LEDGER: 'RESERVE_LEDGER',
  PAYMENT_TRANSACTION: 'PAYMENT_TRANSACTION',
  SETTLEMENT_REQUEST: 'SETTLEMENT_REQUEST',
};

export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  SUBMIT: 'SUBMIT',
  CANCEL: 'CANCEL',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  MARK_READY: 'MARK_READY',
  PREPARE_EXECUTION: 'PREPARE_EXECUTION',
  RECORD_INITIATION: 'RECORD_INITIATION',
  RECORD_EXECUTION: 'RECORD_EXECUTION',
  STATUS_CHANGE: 'STATUS_CHANGE',
  ASSIGN_ROLE: 'ASSIGN_ROLE',
  ROUTE_SETTLEMENT: 'ROUTE_SETTLEMENT',
  SYNC_RESERVE: 'SYNC_RESERVE',
  BIPS_INQUIRY: 'BIPS_INQUIRY',
  BIPS_OUTGOING: 'BIPS_OUTGOING',
  BIPS_RECONCILE: 'BIPS_RECONCILE',
};
