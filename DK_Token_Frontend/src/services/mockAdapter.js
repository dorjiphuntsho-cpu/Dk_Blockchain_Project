import dayjs from 'dayjs';

import {
  AUDIT_ACTIONS,
  ENTITY_TYPES,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  ROLES,
} from '../utils/constants';

const STORAGE_KEY = 'token-admin-portal-mock-db';
const MOCK_DELAY = 200;

function delay() {
  return new Promise((resolve) => window.setTimeout(resolve, MOCK_DELAY));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function generateId(prefix) {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createInitialDb() {
  const now = dayjs();

  const users = [
    {
      id: 'user-admin-1',
      fullName: 'Default Admin',
      email: 'admin@example.com',
      password: 'Admin@123',
      roles: [ROLES.ADMIN],
      isActive: true,
      createdAt: now.subtract(10, 'day').toISOString(),
      updatedAt: now.subtract(1, 'day').toISOString(),
    },
    {
      id: 'user-maker-1',
      fullName: 'Default Maker',
      email: 'maker@example.com',
      password: 'Maker@123',
      roles: [ROLES.MAKER],
      isActive: true,
      createdAt: now.subtract(9, 'day').toISOString(),
      updatedAt: now.subtract(1, 'day').toISOString(),
    },
    {
      id: 'user-checker-1',
      fullName: 'Default Checker',
      email: 'checker@example.com',
      password: 'Checker@123',
      roles: [ROLES.CHECKER],
      isActive: true,
      createdAt: now.subtract(8, 'day').toISOString(),
      updatedAt: now.subtract(1, 'day').toISOString(),
    },
    {
      id: 'user-executor-1',
      fullName: 'Default Executor',
      email: 'executor@example.com',
      password: 'Executor@123',
      roles: [ROLES.EXECUTOR],
      isActive: true,
      createdAt: now.subtract(7, 'day').toISOString(),
      updatedAt: now.subtract(1, 'day').toISOString(),
    },
  ];

  const wallets = [
    {
      id: 'wallet-1',
      userId: 'user-admin-1',
      walletAddress: '4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZQJ6a9F9vM1D7',
      label: 'Admin Treasury',
      isPrimary: true,
      isActive: true,
      createdAt: now.subtract(6, 'day').toISOString(),
      updatedAt: now.subtract(6, 'day').toISOString(),
    },
    {
      id: 'wallet-2',
      userId: 'user-maker-1',
      walletAddress: '9xQeWvG816bUx9EPjHmaT23yvVMpJERqS5eSeyabW8Lx',
      label: 'Maker Operations',
      isPrimary: true,
      isActive: true,
      createdAt: now.subtract(6, 'day').toISOString(),
      updatedAt: now.subtract(6, 'day').toISOString(),
    },
    {
      id: 'wallet-3',
      userId: 'user-checker-1',
      walletAddress: 'Fh7C6FJmp6zkRgZNpmjQe7YQDdyCjTiMQuuLHfoEGoVY',
      label: 'Checker Review',
      isPrimary: true,
      isActive: true,
      createdAt: now.subtract(6, 'day').toISOString(),
      updatedAt: now.subtract(6, 'day').toISOString(),
    },
    {
      id: 'wallet-4',
      userId: 'user-executor-1',
      walletAddress: '8fj3aP1q1N7yVdGQwT3x9LsPkM1sQhYmL4x6cR7nVzDe',
      label: 'Execution Wallet',
      isPrimary: true,
      isActive: true,
      createdAt: now.subtract(6, 'day').toISOString(),
      updatedAt: now.subtract(6, 'day').toISOString(),
    },
  ];

  const tokenRequests = [
    {
      id: 'request-1',
      requestType: REQUEST_TYPES.MINT,
      tokenMintAddress: wallets[1].walletAddress,
      amount: '5000',
      sourceWalletId: null,
      destinationWalletId: 'wallet-2',
      makerUserId: 'user-maker-1',
      checkerUserId: 'user-checker-1',
      status: REQUEST_STATUSES.APPROVED,
      remarks: 'Monthly allocation',
      rejectionReason: null,
      txSignature: null,
      explorerUrl: null,
      executionError: null,
      approvedAt: now.subtract(1, 'day').toISOString(),
      rejectedAt: null,
      executedAt: null,
      createdAt: now.subtract(2, 'day').toISOString(),
      updatedAt: now.subtract(1, 'day').toISOString(),
      approvals: [
        {
          id: 'approval-1',
          checkerUserId: 'user-checker-1',
          action: 'APPROVED',
          comment: 'Approved for execution',
          createdAt: now.subtract(1, 'day').toISOString(),
        },
      ],
    },
    {
      id: 'request-2',
      requestType: REQUEST_TYPES.TRANSFER,
      tokenMintAddress: wallets[1].walletAddress,
      amount: '750',
      sourceWalletId: 'wallet-2',
      destinationWalletId: 'wallet-1',
      makerUserId: 'user-maker-1',
      checkerUserId: null,
      status: REQUEST_STATUSES.PENDING_APPROVAL,
      remarks: 'Treasury rebalance',
      rejectionReason: null,
      txSignature: null,
      explorerUrl: null,
      executionError: null,
      approvedAt: null,
      rejectedAt: null,
      executedAt: null,
      createdAt: now.subtract(12, 'hour').toISOString(),
      updatedAt: now.subtract(12, 'hour').toISOString(),
      approvals: [],
    },
    {
      id: 'request-3',
      requestType: REQUEST_TYPES.BURN,
      tokenMintAddress: wallets[1].walletAddress,
      amount: '120',
      sourceWalletId: 'wallet-2',
      destinationWalletId: null,
      makerUserId: 'user-maker-1',
      checkerUserId: 'user-checker-1',
      status: REQUEST_STATUSES.READY_FOR_EXECUTION,
      remarks: 'Burn obsolete test tokens',
      rejectionReason: null,
      txSignature: null,
      explorerUrl: null,
      executionError: null,
      approvedAt: now.subtract(10, 'hour').toISOString(),
      rejectedAt: null,
      executedAt: null,
      createdAt: now.subtract(16, 'hour').toISOString(),
      updatedAt: now.subtract(8, 'hour').toISOString(),
      approvals: [
        {
          id: 'approval-2',
          checkerUserId: 'user-checker-1',
          action: 'APPROVED',
          comment: 'Ready',
          createdAt: now.subtract(10, 'hour').toISOString(),
        },
      ],
    },
    {
      id: 'request-4',
      requestType: REQUEST_TYPES.TRANSFER,
      tokenMintAddress: wallets[1].walletAddress,
      amount: '250',
      sourceWalletId: 'wallet-2',
      destinationWalletId: 'wallet-4',
      makerUserId: 'user-maker-1',
      checkerUserId: 'user-checker-1',
      status: REQUEST_STATUSES.EXECUTED,
      remarks: 'Test transfer complete',
      rejectionReason: null,
      txSignature: '5h7QyMockTxSig12345',
      explorerUrl: 'https://explorer.solana.com/tx/5h7QyMockTxSig12345?cluster=testnet',
      executionError: null,
      approvedAt: now.subtract(4, 'day').toISOString(),
      rejectedAt: null,
      executedAt: now.subtract(3, 'day').toISOString(),
      createdAt: now.subtract(5, 'day').toISOString(),
      updatedAt: now.subtract(3, 'day').toISOString(),
      approvals: [
        {
          id: 'approval-3',
          checkerUserId: 'user-checker-1',
          action: 'APPROVED',
          comment: 'Approved',
          createdAt: now.subtract(4, 'day').toISOString(),
        },
      ],
    },
  ];

  const auditLogs = [
    {
      id: 'audit-1',
      actorUserId: 'user-admin-1',
      entityType: ENTITY_TYPES.USER,
      entityId: 'user-maker-1',
      action: AUDIT_ACTIONS.CREATE,
      metadata: { fullName: 'Default Maker', roles: [ROLES.MAKER] },
      createdAt: now.subtract(9, 'day').toISOString(),
    },
    {
      id: 'audit-2',
      actorUserId: 'user-maker-1',
      entityType: ENTITY_TYPES.TOKEN_REQUEST,
      entityId: 'request-2',
      action: AUDIT_ACTIONS.SUBMIT,
      metadata: { previousStatus: REQUEST_STATUSES.DRAFT, newStatus: REQUEST_STATUSES.PENDING_APPROVAL },
      createdAt: now.subtract(12, 'hour').toISOString(),
    },
  ];

  const solanaConfig = {
    rpcUrl: 'http://127.0.0.1:8899',
    commitment: 'confirmed',
    programId: '49fwAJRLMtbCLLqZDZTBKZtwDaBTgm1oA1FWnidYDQJp',
    configAddress: '9Qv8s7mpaQv7Z5Lb4Y4N6A5cgM4L4QX1Cj2sL8zj9s1P',
    idlPath: 'dk-token/target/idl/dk_token.json',
    autoBootstrapEnabled: true,
    configuredSigners: {
      admin: wallets[0].walletAddress,
      maker: wallets[1].walletAddress,
      checker: wallets[2].walletAddress,
    },
    onChain: {
      admin: wallets[0].walletAddress,
      checkers: [wallets[0].walletAddress, wallets[2].walletAddress],
    },
  };

  const managedTokens = [];

  return {
    users,
    wallets,
    tokenRequests,
    auditLogs,
    solanaConfig,
    managedTokens,
  };
}

function getDb() {
  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    const initialDb = createInitialDb();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDb));
    return initialDb;
  }

  return JSON.parse(saved);
}

function setDb(db) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  return db;
}

function basicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    isActive: user.isActive,
    roles: user.roles,
  };
}

function serializeUser(db, user) {
  return {
    ...basicUser(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    wallets: db.wallets.filter((wallet) => wallet.userId === user.id),
  };
}

function serializeWallet(db, wallet) {
  return {
    ...wallet,
    user: basicUser(db.users.find((user) => user.id === wallet.userId)),
  };
}

function serializeAuditLog(db, log) {
  return {
    ...log,
    actorUser: basicUser(db.users.find((user) => user.id === log.actorUserId)),
  };
}

function serializeTokenRequest(db, request) {
  return {
    ...request,
    sourceWallet: request.sourceWalletId ? serializeWallet(db, db.wallets.find((wallet) => wallet.id === request.sourceWalletId)) : null,
    destinationWallet: request.destinationWalletId ? serializeWallet(db, db.wallets.find((wallet) => wallet.id === request.destinationWalletId)) : null,
    makerUser: basicUser(db.users.find((user) => user.id === request.makerUserId)),
    checkerUser: request.checkerUserId ? basicUser(db.users.find((user) => user.id === request.checkerUserId)) : null,
    approvals: request.approvals.map((approval) => ({
      ...approval,
      checkerUser: basicUser(db.users.find((user) => user.id === approval.checkerUserId)),
    })),
  };
}

function getPagination(query, totalItems) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);

  return {
    page,
    limit,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / limit)),
  };
}

function paginate(items, query = {}) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const start = (page - 1) * limit;
  const paginated = items.slice(start, start + limit);

  return {
    items: paginated,
    pagination: getPagination(query, items.length),
  };
}

function sortItems(items, sortBy = 'createdAt', sortOrder = 'desc') {
  return [...items].sort((left, right) => {
    const leftValue = left[sortBy];
    const rightValue = right[sortBy];

    if (leftValue === rightValue) {
      return 0;
    }

    if (sortOrder === 'asc') {
      return leftValue > rightValue ? 1 : -1;
    }

    return leftValue < rightValue ? 1 : -1;
  });
}

function createListResponse(message, items, pagination) {
  return {
    success: true,
    message,
    data: {
      items,
      pagination,
    },
  };
}

function createDetailResponse(message, data) {
  return {
    success: true,
    message,
    data,
  };
}

function addAuditLog(db, entry) {
  db.auditLogs.unshift({
    id: generateId('audit'),
    createdAt: new Date().toISOString(),
    ...entry,
  });
}

function ensureRequestPayload(payload) {
  if (payload.requestType === REQUEST_TYPES.MINT && !payload.destinationWalletId) {
    throw new Error('Destination wallet is required for mint requests');
  }

  if (payload.requestType === REQUEST_TYPES.TRANSFER) {
    if (!payload.sourceWalletId || !payload.destinationWalletId) {
      throw new Error('Source and destination wallets are required for transfer requests');
    }

    if (payload.sourceWalletId === payload.destinationWalletId) {
      throw new Error('Source and destination wallets cannot be the same');
    }
  }

  if (payload.requestType === REQUEST_TYPES.BURN && !payload.sourceWalletId) {
    throw new Error('Source wallet is required for burn requests');
  }
}

async function perform(operation) {
  await delay();
  return operation();
}

function getActor(actorUser) {
  if (!actorUser?.id) {
    throw new Error('Authenticated user not found');
  }

  return actorUser;
}

function serializeSolanaConfig(db) {
  const config = db.solanaConfig;
  const adminSignerMatchesOnChain = config.onChain.admin === config.configuredSigners.admin;
  const checkerSignerConfiguredOnChain = config.onChain.checkers.includes(config.configuredSigners.checker);
  const warnings = [];

  if (!adminSignerMatchesOnChain) {
    warnings.push(
      `Configured backend admin signer ${config.configuredSigners.admin} does not match on-chain admin ${config.onChain.admin}.`,
    );
  }

  if (!checkerSignerConfiguredOnChain) {
    warnings.push(
      `Configured backend checker signer ${config.configuredSigners.checker} is not registered on chain.`,
    );
  }

  return {
    ...clone(config),
    configExists: true,
    adminSignerMatchesOnChain,
    checkerSignerConfiguredOnChain,
    canManageOnChainConfig: adminSignerMatchesOnChain,
    warnings,
  };
}

function serializeManagedToken(db, token) {
  return {
    ...token,
    creatorUser: token.creatorUserId ? basicUser(db.users.find((user) => user.id === token.creatorUserId)) : null,
    onChain: {
      supply: token.supply,
      decimals: token.decimals,
      mintAuthority: token.mintAuthority,
      freezeAuthority: token.freezeAuthority,
      isInitialized: true,
    },
    warning: null,
  };
}

export const mockAdapter = {
  auth: {
    login: async ({ email, password }) =>
      perform(() => {
        const db = getDb();
        const user = db.users.find(
          (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password && item.isActive,
        );

        if (!user) {
          throw new Error('Invalid email or password');
        }

        return createDetailResponse('Login successful', {
          token: `mock-token-${user.id}`,
          user: basicUser(user),
        });
      }),
    me: async (token) =>
      perform(() => {
        const db = getDb();
        const userId = token?.replace('mock-token-', '');
        const user = db.users.find((item) => item.id === userId);

        if (!user) {
          throw new Error('Unable to resolve current user');
        }

        return createDetailResponse('Current user fetched successfully', basicUser(user));
      }),
  },
  users: {
    list: async (query = {}) =>
      perform(() => {
        const db = getDb();
        let users = db.users.map((user) => serializeUser(db, user));

        if (query.search) {
          const search = query.search.toLowerCase();
          users = users.filter((user) =>
            user.fullName.toLowerCase().includes(search) || user.email.toLowerCase().includes(search),
          );
        }

        if (query.isActive !== undefined && query.isActive !== '') {
          const isActive = String(query.isActive) === 'true';
          users = users.filter((user) => user.isActive === isActive);
        }

        users = sortItems(users, query.sortBy || 'createdAt', query.sortOrder || 'desc');
        const result = paginate(users, query);
        return createListResponse('Users fetched successfully', result.items, result.pagination);
      }),
    getById: async (id) =>
      perform(() => {
        const db = getDb();
        const user = db.users.find((item) => item.id === id);

        if (!user) {
          throw new Error('User not found');
        }

        return createDetailResponse('User fetched successfully', serializeUser(db, user));
      }),
    create: async (payload, actorUser) =>
      perform(() => {
        const db = getDb();
        const now = new Date().toISOString();
        const user = {
          id: generateId('user'),
          fullName: payload.fullName,
          email: payload.email.toLowerCase(),
          password: payload.password,
          roles: payload.roles || [],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };

        db.users.unshift(user);
        addAuditLog(db, {
          actorUserId: getActor(actorUser).id,
          entityType: ENTITY_TYPES.USER,
          entityId: user.id,
          action: AUDIT_ACTIONS.CREATE,
          metadata: { fullName: user.fullName, email: user.email, roles: user.roles },
        });
        setDb(db);

        return createDetailResponse('User created successfully', serializeUser(db, user));
      }),
    update: async (id, payload, actorUser) =>
      perform(() => {
        const db = getDb();
        const user = db.users.find((item) => item.id === id);

        if (!user) {
          throw new Error('User not found');
        }

        Object.assign(user, {
          ...payload,
          email: payload.email ? payload.email.toLowerCase() : user.email,
          updatedAt: new Date().toISOString(),
        });

        addAuditLog(db, {
          actorUserId: getActor(actorUser).id,
          entityType: ENTITY_TYPES.USER,
          entityId: id,
          action: AUDIT_ACTIONS.UPDATE,
          metadata: { changedFields: payload },
        });
        setDb(db);

        return createDetailResponse('User updated successfully', serializeUser(db, user));
      }),
    updateStatus: async (id, isActive, actorUser) =>
      perform(() => {
        const db = getDb();
        const user = db.users.find((item) => item.id === id);

        if (!user) {
          throw new Error('User not found');
        }

        user.isActive = isActive;
        user.updatedAt = new Date().toISOString();
        addAuditLog(db, {
          actorUserId: getActor(actorUser).id,
          entityType: ENTITY_TYPES.USER,
          entityId: id,
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          metadata: { isActive },
        });
        setDb(db);

        return createDetailResponse('User status updated successfully', serializeUser(db, user));
      }),
    assignRoles: async (id, roles, actorUser) =>
      perform(() => {
        const db = getDb();
        const user = db.users.find((item) => item.id === id);

        if (!user) {
          throw new Error('User not found');
        }

        user.roles = Array.from(new Set([...(user.roles || []), ...roles]));
        user.updatedAt = new Date().toISOString();
        addAuditLog(db, {
          actorUserId: getActor(actorUser).id,
          entityType: ENTITY_TYPES.ROLE_ASSIGNMENT,
          entityId: id,
          action: AUDIT_ACTIONS.ASSIGN_ROLE,
          metadata: { roles },
        });
        setDb(db);

        return createDetailResponse('Roles assigned successfully', serializeUser(db, user));
      }),
  },
  wallets: {
    list: async (query = {}) =>
      perform(() => {
        const db = getDb();
        let wallets = db.wallets.map((wallet) => serializeWallet(db, wallet));

        if (query.userId) {
          wallets = wallets.filter((wallet) => wallet.userId === query.userId);
        }

        if (query.walletAddress) {
          const search = query.walletAddress.toLowerCase();
          wallets = wallets.filter((wallet) => wallet.walletAddress.toLowerCase().includes(search));
        }

        if (query.isActive !== undefined && query.isActive !== '') {
          const isActive = String(query.isActive) === 'true';
          wallets = wallets.filter((wallet) => wallet.isActive === isActive);
        }

        if (query.isPrimary !== undefined && query.isPrimary !== '') {
          const isPrimary = String(query.isPrimary) === 'true';
          wallets = wallets.filter((wallet) => wallet.isPrimary === isPrimary);
        }

        wallets = sortItems(wallets, query.sortBy || 'createdAt', query.sortOrder || 'desc');
        const result = paginate(wallets, query);
        return createListResponse('Wallets fetched successfully', result.items, result.pagination);
      }),
    getById: async (id) =>
      perform(() => {
        const db = getDb();
        const wallet = db.wallets.find((item) => item.id === id);

        if (!wallet) {
          throw new Error('Wallet not found');
        }

        return createDetailResponse('Wallet fetched successfully', serializeWallet(db, wallet));
      }),
    getTokenBalances: async (id) =>
      perform(() => {
        const db = getDb();
        const wallet = db.wallets.find((item) => item.id === id);

        if (!wallet) {
          throw new Error('Wallet not found');
        }

        const balances = db.tokenRequests
          .filter((request) => request.status === REQUEST_STATUSES.EXECUTED)
          .reduce((accumulator, request) => {
            const current = accumulator.get(request.tokenMintAddress) || 0;

            if (request.destinationWalletId === id) {
              accumulator.set(request.tokenMintAddress, current + Number(request.amount));
            }

            if (request.sourceWalletId === id) {
              accumulator.set(request.tokenMintAddress, current - Number(request.amount));
            }

            return accumulator;
          }, new Map());

        const items = Array.from(balances.entries())
          .filter(([, amount]) => amount !== 0)
          .map(([mintAddress, amount]) => ({
            tokenAccountAddress: `mock-token-account-${id}-${mintAddress}`,
            mintAddress,
            rawAmount: String(amount),
            decimals: 0,
            amount: String(amount),
          }));

        return createDetailResponse('Wallet token balances fetched successfully', {
          wallet: serializeWallet(db, wallet),
          balances: items,
        });
      }),
    create: async (payload, actorUser) =>
      perform(() => {
        const db = getDb();
        const now = new Date().toISOString();

        if (payload.isPrimary) {
          db.wallets
            .filter((wallet) => wallet.userId === payload.userId)
            .forEach((wallet) => {
              wallet.isPrimary = false;
            });
        }

        const wallet = {
          id: generateId('wallet'),
          ...payload,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };

        db.wallets.unshift(wallet);
        addAuditLog(db, {
          actorUserId: getActor(actorUser).id,
          entityType: ENTITY_TYPES.WALLET,
          entityId: wallet.id,
          action: AUDIT_ACTIONS.CREATE,
          metadata: payload,
        });
        setDb(db);

        return createDetailResponse('Wallet created successfully', serializeWallet(db, wallet));
      }),
    update: async (id, payload, actorUser) =>
      perform(() => {
        const db = getDb();
        const wallet = db.wallets.find((item) => item.id === id);

        if (!wallet) {
          throw new Error('Wallet not found');
        }

        if (payload.isPrimary) {
          db.wallets
            .filter((item) => item.userId === (payload.userId || wallet.userId) && item.id !== id)
            .forEach((item) => {
              item.isPrimary = false;
            });
        }

        Object.assign(wallet, payload, { updatedAt: new Date().toISOString() });
        addAuditLog(db, {
          actorUserId: getActor(actorUser).id,
          entityType: ENTITY_TYPES.WALLET,
          entityId: id,
          action: AUDIT_ACTIONS.UPDATE,
          metadata: payload,
        });
        setDb(db);

        return createDetailResponse('Wallet updated successfully', serializeWallet(db, wallet));
      }),
    updateStatus: async (id, isActive, actorUser) =>
      perform(() => {
        const db = getDb();
        const wallet = db.wallets.find((item) => item.id === id);

        if (!wallet) {
          throw new Error('Wallet not found');
        }

        wallet.isActive = isActive;
        wallet.updatedAt = new Date().toISOString();
        addAuditLog(db, {
          actorUserId: getActor(actorUser).id,
          entityType: ENTITY_TYPES.WALLET,
          entityId: id,
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          metadata: { isActive },
        });
        setDb(db);

        return createDetailResponse('Wallet status updated successfully', serializeWallet(db, wallet));
      }),
  },
  tokenRequests: {
    list: async (query = {}) =>
      perform(() => {
        const db = getDb();
        let requests = db.tokenRequests.map((request) => serializeTokenRequest(db, request));

        if (query.status) {
          requests = requests.filter((request) => request.status === query.status);
        }

        if (query.requestType) {
          requests = requests.filter((request) => request.requestType === query.requestType);
        }

        if (query.makerUserId) {
          requests = requests.filter((request) => request.makerUserId === query.makerUserId);
        }

        if (query.checkerUserId) {
          requests = requests.filter((request) => request.checkerUserId === query.checkerUserId);
        }

        if (query.tokenMintAddress) {
          requests = requests.filter((request) =>
            request.tokenMintAddress.toLowerCase().includes(query.tokenMintAddress.toLowerCase()),
          );
        }

        if (query.dateFrom) {
          requests = requests.filter((request) => dayjs(request.createdAt).isAfter(dayjs(query.dateFrom).subtract(1, 'day')));
        }

        if (query.dateTo) {
          requests = requests.filter((request) => dayjs(request.createdAt).isBefore(dayjs(query.dateTo).add(1, 'day')));
        }

        requests = sortItems(requests, query.sortBy || 'createdAt', query.sortOrder || 'desc');
        const result = paginate(requests, query);
        return createListResponse('Token requests fetched successfully', result.items, result.pagination);
      }),
    getById: async (id) =>
      perform(() => {
        const db = getDb();
        const request = db.tokenRequests.find((item) => item.id === id);

        if (!request) {
          throw new Error('Token request not found');
        }

        return createDetailResponse('Token request fetched successfully', serializeTokenRequest(db, request));
      }),
    create: async (payload, actorUser) =>
      perform(() => {
        const db = getDb();
        const actor = getActor(actorUser);
        ensureRequestPayload(payload);
        const now = new Date().toISOString();
        const request = {
          id: generateId('request'),
          ...payload,
          amount: String(payload.amount),
          makerUserId: actor.id,
          checkerUserId: null,
          status: REQUEST_STATUSES.DRAFT,
          rejectionReason: null,
          txSignature: null,
          explorerUrl: null,
          executionError: null,
          approvedAt: null,
          rejectedAt: null,
          executedAt: null,
          createdAt: now,
          updatedAt: now,
          approvals: [],
        };

        db.tokenRequests.unshift(request);
        addAuditLog(db, {
          actorUserId: actor.id,
          entityType: ENTITY_TYPES.TOKEN_REQUEST,
          entityId: request.id,
          action: AUDIT_ACTIONS.CREATE,
          metadata: {
            requestType: request.requestType,
            amount: request.amount,
          },
        });
        setDb(db);

        return createDetailResponse('Token request created successfully', serializeTokenRequest(db, request));
      }),
    update: async (id, payload, actorUser) =>
      perform(() => {
        const db = getDb();
        const actor = getActor(actorUser);
        const request = db.tokenRequests.find((item) => item.id === id);

        if (!request) {
          throw new Error('Token request not found');
        }

        if (request.status !== REQUEST_STATUSES.DRAFT || request.makerUserId !== actor.id) {
          throw new Error('Only the maker can edit draft requests');
        }

        const merged = { ...request, ...payload };
        ensureRequestPayload(merged);
        Object.assign(request, payload, {
          amount: payload.amount ? String(payload.amount) : request.amount,
          updatedAt: new Date().toISOString(),
        });

        addAuditLog(db, {
          actorUserId: actor.id,
          entityType: ENTITY_TYPES.TOKEN_REQUEST,
          entityId: id,
          action: AUDIT_ACTIONS.UPDATE,
          metadata: payload,
        });
        setDb(db);

        return createDetailResponse('Token request updated successfully', serializeTokenRequest(db, request));
      }),
    submit: async (id, actorUser) =>
      perform(() => {
        const db = getDb();
        const actor = getActor(actorUser);
        const request = db.tokenRequests.find((item) => item.id === id);

        if (!request || request.makerUserId !== actor.id || request.status !== REQUEST_STATUSES.DRAFT) {
          throw new Error('Only draft requests owned by the maker can be submitted');
        }

        request.status = REQUEST_STATUSES.PENDING_APPROVAL;
        request.updatedAt = new Date().toISOString();
        addAuditLog(db, {
          actorUserId: actor.id,
          entityType: ENTITY_TYPES.TOKEN_REQUEST,
          entityId: id,
          action: AUDIT_ACTIONS.SUBMIT,
          metadata: { previousStatus: REQUEST_STATUSES.DRAFT, newStatus: REQUEST_STATUSES.PENDING_APPROVAL },
        });
        setDb(db);

        return createDetailResponse('Token request submitted successfully', serializeTokenRequest(db, request));
      }),
    approve: async (id, payload, actorUser) =>
      perform(() => {
        const db = getDb();
        const actor = getActor(actorUser);
        const request = db.tokenRequests.find((item) => item.id === id);

        if (!request || request.status !== REQUEST_STATUSES.PENDING_APPROVAL || request.makerUserId === actor.id) {
          throw new Error('Request cannot be approved');
        }

        request.status = REQUEST_STATUSES.APPROVED;
        request.checkerUserId = actor.id;
        request.approvedAt = new Date().toISOString();
        request.updatedAt = new Date().toISOString();
        request.approvals.unshift({
          id: generateId('approval'),
          checkerUserId: actor.id,
          action: 'APPROVED',
          comment: payload.comment || '',
          createdAt: new Date().toISOString(),
        });

        addAuditLog(db, {
          actorUserId: actor.id,
          entityType: ENTITY_TYPES.TOKEN_REQUEST,
          entityId: id,
          action: AUDIT_ACTIONS.APPROVE,
          metadata: { comment: payload.comment || null },
        });
        setDb(db);

        return createDetailResponse('Request approved successfully', serializeTokenRequest(db, request));
      }),
    reject: async (id, payload, actorUser) =>
      perform(() => {
        const db = getDb();
        const actor = getActor(actorUser);
        const request = db.tokenRequests.find((item) => item.id === id);

        if (!request || request.status !== REQUEST_STATUSES.PENDING_APPROVAL || request.makerUserId === actor.id) {
          throw new Error('Request cannot be rejected');
        }

        request.status = REQUEST_STATUSES.REJECTED;
        request.checkerUserId = actor.id;
        request.rejectedAt = new Date().toISOString();
        request.rejectionReason = payload.rejectionReason;
        request.updatedAt = new Date().toISOString();
        request.approvals.unshift({
          id: generateId('approval'),
          checkerUserId: actor.id,
          action: 'REJECTED',
          comment: payload.comment || payload.rejectionReason,
          createdAt: new Date().toISOString(),
        });

        addAuditLog(db, {
          actorUserId: actor.id,
          entityType: ENTITY_TYPES.TOKEN_REQUEST,
          entityId: id,
          action: AUDIT_ACTIONS.REJECT,
          metadata: payload,
        });
        setDb(db);

        return createDetailResponse('Request rejected successfully', serializeTokenRequest(db, request));
      }),
    markReady: async (id, actorUser) =>
      perform(() => {
        const db = getDb();
        const actor = getActor(actorUser);
        const request = db.tokenRequests.find((item) => item.id === id);

        if (!request || request.status !== REQUEST_STATUSES.APPROVED) {
          throw new Error('Only approved requests can be marked ready');
        }

        request.status = REQUEST_STATUSES.READY_FOR_EXECUTION;
        request.updatedAt = new Date().toISOString();
        addAuditLog(db, {
          actorUserId: actor.id,
          entityType: ENTITY_TYPES.TOKEN_REQUEST,
          entityId: id,
          action: AUDIT_ACTIONS.MARK_READY,
          metadata: { newStatus: REQUEST_STATUSES.READY_FOR_EXECUTION },
        });
        setDb(db);

        return createDetailResponse('Request marked ready successfully', {
          tokenRequest: serializeTokenRequest(db, request),
          executionPayload: {
            integrationReady: true,
            executionMode: 'mock-local-validator',
            operation: request.requestType,
            requestId: request.id,
          },
        });
      }),
    execute: async (id, actorUser) =>
      perform(() => {
        const db = getDb();
        const actor = getActor(actorUser);
        const request = db.tokenRequests.find((item) => item.id === id);

        if (!request || request.status !== REQUEST_STATUSES.READY_FOR_EXECUTION) {
          throw new Error('Only ready requests can be executed');
        }

        const now = new Date().toISOString();
        const txSignature = `mock-tx-${Math.random().toString(36).slice(2, 14)}`;
        request.status = REQUEST_STATUSES.EXECUTED;
        request.txSignature = txSignature;
        request.explorerUrl = `https://explorer.solana.com/tx/${txSignature}?cluster=custom`;
        request.executionError = null;
        request.executedAt = now;
        request.updatedAt = now;

        addAuditLog(db, {
          actorUserId: actor.id,
          entityType: ENTITY_TYPES.TOKEN_REQUEST,
          entityId: id,
          action: AUDIT_ACTIONS.RECORD_EXECUTION,
          metadata: {
            status: REQUEST_STATUSES.EXECUTED,
            txSignature,
            explorerUrl: request.explorerUrl,
          },
        });
        setDb(db);

        return createDetailResponse('Token request executed successfully', {
          tokenRequest: serializeTokenRequest(db, request),
          execution: {
            txSignature,
            explorerUrl: request.explorerUrl,
            executionMode: 'mock-local-validator',
          },
        });
      }),
    recordExecution: async (id, payload, actorUser) =>
      perform(() => {
        const db = getDb();
        const actor = getActor(actorUser);
        const request = db.tokenRequests.find((item) => item.id === id);

        if (!request || request.status !== REQUEST_STATUSES.READY_FOR_EXECUTION) {
          throw new Error('Only ready requests can record execution');
        }

        request.status = payload.status;
        request.txSignature = payload.txSignature || null;
        request.explorerUrl = payload.explorerUrl || null;
        request.executionError = payload.status === REQUEST_STATUSES.FAILED ? payload.executionError || 'Unknown execution failure' : null;
        request.executedAt = new Date().toISOString();
        request.updatedAt = new Date().toISOString();
        addAuditLog(db, {
          actorUserId: actor.id,
          entityType: ENTITY_TYPES.TOKEN_REQUEST,
          entityId: id,
          action: AUDIT_ACTIONS.RECORD_EXECUTION,
          metadata: payload,
        });
        setDb(db);

        return createDetailResponse('Execution result recorded successfully', serializeTokenRequest(db, request));
      }),
    dashboard: async (actorUser) =>
      perform(() => {
        const db = getDb();
        const actor = getActor(actorUser);
        const allRequests = db.tokenRequests.map((request) => serializeTokenRequest(db, request));
        const visibleRequests = allRequests.filter((request) => {
          if (actor.roles.includes(ROLES.ADMIN)) {
            return true;
          }

          if (actor.roles.includes(ROLES.MAKER)) {
            return request.makerUserId === actor.id;
          }

          if (actor.roles.includes(ROLES.CHECKER)) {
            return request.status === REQUEST_STATUSES.PENDING_APPROVAL || request.checkerUserId === actor.id;
          }

          if (actor.roles.includes(ROLES.EXECUTOR)) {
            return [REQUEST_STATUSES.APPROVED, REQUEST_STATUSES.READY_FOR_EXECUTION, REQUEST_STATUSES.EXECUTED, REQUEST_STATUSES.FAILED].includes(request.status);
          }

          return false;
        });

        return createDetailResponse('Dashboard overview fetched successfully', {
          summary: {
            totalRequests: visibleRequests.length,
            pendingApprovals: visibleRequests.filter((request) => request.status === REQUEST_STATUSES.PENDING_APPROVAL).length,
            approvedRequests: visibleRequests.filter((request) => request.status === REQUEST_STATUSES.APPROVED).length,
            readyForExecution: visibleRequests.filter((request) => request.status === REQUEST_STATUSES.READY_FOR_EXECUTION).length,
            executedRequests: visibleRequests.filter((request) => request.status === REQUEST_STATUSES.EXECUTED).length,
            failedRequests: visibleRequests.filter((request) => request.status === REQUEST_STATUSES.FAILED).length,
          },
          recentRequests: sortItems(visibleRequests, 'createdAt', 'desc').slice(0, 5),
          pendingApprovals: visibleRequests.filter((request) => request.status === REQUEST_STATUSES.PENDING_APPROVAL).slice(0, 5),
          auditTrail: db.auditLogs.slice(0, 5).map((log) => serializeAuditLog(db, log)),
        });
      }),
  },
  auditLogs: {
    list: async (query = {}) =>
      perform(() => {
        const db = getDb();
        let logs = db.auditLogs.map((log) => serializeAuditLog(db, log));

        if (query.entityType) {
          logs = logs.filter((log) => log.entityType === query.entityType);
        }

        if (query.actorUserId) {
          logs = logs.filter((log) => log.actorUserId === query.actorUserId);
        }

        if (query.action) {
          logs = logs.filter((log) => log.action === query.action);
        }

        logs = sortItems(logs, query.sortBy || 'createdAt', query.sortOrder || 'desc');
        const result = paginate(logs, query);
        return createListResponse('Audit logs fetched successfully', result.items, result.pagination);
      }),
  },
  solanaAdmin: {
    getConfigStatus: async () =>
      perform(() => {
        const db = getDb();
        return createDetailResponse('Solana config status fetched successfully', serializeSolanaConfig(db));
      }),
    createTokenMint: async (decimals = 0) =>
      perform(() => {
        const db = getDb();
        const mintAddress = `mint-${Math.random().toString(36).slice(2, 14)}`;
        const token = {
          id: generateId('managed-token'),
          mintAddress,
          decimals: Number(decimals),
          mintAuthority: db.solanaConfig.configuredSigners.admin,
          freezeAuthority: db.solanaConfig.configuredSigners.admin,
          supply: '0',
          tokenAuthority: db.solanaConfig.configuredSigners.admin,
          txSignature: `mock-mint-${Math.random().toString(36).slice(2, 14)}`,
          explorerUrl: 'https://explorer.solana.com/?cluster=custom',
          createdTxSignature: `mock-mint-${Math.random().toString(36).slice(2, 14)}`,
          creatorUserId: 'user-admin-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.managedTokens.unshift(token);
        setDb(db);
        return createDetailResponse('Managed token mint created successfully', serializeManagedToken(db, token));
      }),
    addChecker: async (checkerAddress) =>
      perform(() => {
        const db = getDb();
        if (!db.solanaConfig.onChain.checkers.includes(checkerAddress)) {
          db.solanaConfig.onChain.checkers.push(checkerAddress);
          setDb(db);
        }

        return createDetailResponse('Checker added successfully', serializeSolanaConfig(db));
      }),
    removeChecker: async (checkerAddress) =>
      perform(() => {
        const db = getDb();
        if (db.solanaConfig.onChain.admin === checkerAddress) {
          throw new Error('Admin checker cannot be removed');
        }

        db.solanaConfig.onChain.checkers = db.solanaConfig.onChain.checkers.filter((address) => address !== checkerAddress);
        setDb(db);

        return createDetailResponse('Checker removed successfully', serializeSolanaConfig(db));
      }),
    setAdmin: async (newAdminAddress) =>
      perform(() => {
        const db = getDb();
        db.solanaConfig.onChain.admin = newAdminAddress;
        if (!db.solanaConfig.onChain.checkers.includes(newAdminAddress)) {
          db.solanaConfig.onChain.checkers.push(newAdminAddress);
        }
        setDb(db);

        return createDetailResponse('On-chain admin updated successfully', serializeSolanaConfig(db));
      }),
  },
  managedTokens: {
    list: async (query = {}) =>
      perform(() => {
        const db = getDb();
        let items = db.managedTokens.map((token) => serializeManagedToken(db, token));

        if (query.search) {
          const search = query.search.toLowerCase();
          items = items.filter((token) =>
            token.mintAddress.toLowerCase().includes(search)
            || token.tokenAuthority.toLowerCase().includes(search),
          );
        }

        items = sortItems(items, query.sortBy || 'createdAt', query.sortOrder || 'desc');
        const result = paginate(items, query);
        return createListResponse('Managed tokens fetched successfully', result.items, result.pagination);
      }),
    getById: async (id) =>
      perform(() => {
        const db = getDb();
        const token = db.managedTokens.find((item) => item.id === id);

        if (!token) {
          throw new Error('Managed token not found');
        }

        return createDetailResponse('Managed token fetched successfully', serializeManagedToken(db, token));
      }),
  },
};
