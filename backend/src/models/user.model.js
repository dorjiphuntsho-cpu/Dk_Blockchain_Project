function normalizeLinkedBankAccountNumbers(user) {
  const normalized = [];
  const seen = new Set();

  for (const value of [user.linkedBankAccountNumber, ...(user.linkedBankAccountNumbers || [])]) {
    const accountNumber = String(value || '').trim();
    if (!accountNumber || seen.has(accountNumber)) {
      continue;
    }
    seen.add(accountNumber);
    normalized.push(accountNumber);
  }

  return normalized;
}

function normalizeLinkedBankAccounts(user) {
  const normalized = [];
  const seen = new Set();

  for (const account of user.customerBankAccounts || []) {
    const accountNumber = String(account.accountNumber || '').trim();
    if (!accountNumber) {
      continue;
    }

    const key = `${account.bankId}:${accountNumber}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push({
      id: account.id,
      bankId: account.bankId,
      bankCode: account.bank?.code || null,
      bankName: account.bank?.name || null,
      accountNumber,
      accountName: account.accountName || null,
      isPrimary: Boolean(account.isPrimary),
      isActive: Boolean(account.isActive),
    });
  }

  return normalized;
}

const userInclude = {
  roles: {
    include: {
      role: true,
    },
  },
  wallets: {
    select: {
      id: true,
      walletAddress: true,
      label: true,
      isPrimary: true,
      isActive: true,
    },
  },
  customerBankAccounts: {
    where: {
      isActive: true,
    },
    orderBy: [
      { isPrimary: 'desc' },
      { createdAt: 'asc' },
    ],
    include: {
      bank: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },
};

function serializeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    cid: user.cid,
    customerType: user.customerType,
    linkedBankAccountNumber: user.linkedBankAccountNumber,
    linkedBankAccountNumbers: normalizeLinkedBankAccountNumbers(user),
    linkedBankAccounts: normalizeLinkedBankAccounts(user),
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.roles.map((item) => item.role.name),
    wallets: user.wallets,
  };
}

module.exports = {
  normalizeLinkedBankAccounts,
  normalizeLinkedBankAccountNumbers,
  userInclude,
  serializeUser,
};
