const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { buildPagination, getPagination, getSortOptions } = require('../utils/pagination');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../utils/enums');
const { bankInclude } = require('../models/bank.model');
const auditLogService = require('./auditLog.service');

const DK_BANK_CODE = '1060';

function ensureIssuerRule(payload, bank) {
  if (payload.isIssuer === true && bank.code !== DK_BANK_CODE) {
    throw new ApiError(400, 'Only DK Bank can be marked as the issuer in version one');
  }
}

async function getBankOrThrow(id, tx = prisma) {
  const bank = await tx.bank.findUnique({
    where: { id },
    include: bankInclude,
  });

  if (!bank) {
    throw new ApiError(404, 'Bank not found');
  }

  return bank;
}

async function getBankAccountOrThrow(bankId, accountId, tx = prisma) {
  const account = await tx.bankAccount.findFirst({
    where: {
      id: accountId,
      bankId,
    },
  });

  if (!account) {
    throw new ApiError(404, 'Bank account not found');
  }

  return account;
}

async function getBankTokenAccountOrThrow(bankId, tokenAccountId, tx = prisma) {
  const tokenAccount = await tx.bankTokenAccount.findFirst({
    where: {
      id: tokenAccountId,
      bankId,
    },
  });

  if (!tokenAccount) {
    throw new ApiError(404, 'Bank token account not found');
  }

  return tokenAccount;
}

async function createAuditLog(actorUserId, bankId, action, metadata, tx) {
  await auditLogService.createAuditLog(
    {
      actorUserId,
      entityType: AUDIT_ENTITY_TYPES.BANK,
      entityId: bankId,
      action,
      metadata,
    },
    tx,
  );
}

async function listBanks(query) {
  const { page, limit, skip } = getPagination(query);
  const orderBy = getSortOptions(query, ['createdAt', 'updatedAt', 'name', 'code'], { name: 'asc' });
  const where = {
    ...(query.code
      ? {
          code: {
            contains: query.code,
            mode: 'insensitive',
          },
        }
      : {}),
    ...(query.name
      ? {
          name: {
            contains: query.name,
            mode: 'insensitive',
          },
        }
      : {}),
    ...(typeof query.supportsBtn === 'boolean' ? { supportsBtn: query.supportsBtn } : {}),
    ...(typeof query.supportsBipsSettlement === 'boolean'
      ? { supportsBipsSettlement: query.supportsBipsSettlement }
      : {}),
    ...(typeof query.isIssuer === 'boolean' ? { isIssuer: query.isIssuer } : {}),
    ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
  };

  const [items, totalItems] = await prisma.$transaction([
    prisma.bank.findMany({
      where,
      include: bankInclude,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.bank.count({ where }),
  ]);

  return {
    items,
    pagination: buildPagination({ page, limit, totalItems }),
  };
}

async function getBankById(id) {
  return getBankOrThrow(id);
}

async function updateBank(id, payload, actorUserId) {
  const existingBank = await getBankOrThrow(id);
  ensureIssuerRule(payload, existingBank);

  const changedFields = {};
  for (const field of ['name', 'binNumber', 'panNumber', 'treasuryWalletAddress', 'supportsBtn', 'supportsBipsSettlement', 'isIssuer', 'isActive']) {
    if (payload[field] !== undefined && payload[field] !== existingBank[field]) {
      changedFields[field] = {
        previous: existingBank[field],
        current: payload[field],
      };
    }
  }

  return prisma.$transaction(async (tx) => {
    if (payload.isIssuer === true) {
      await tx.bank.updateMany({
        where: {
          id: {
            not: id,
          },
          isIssuer: true,
        },
        data: {
          isIssuer: false,
        },
      });
    }

    const updatedBank = await tx.bank.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.binNumber !== undefined ? { binNumber: payload.binNumber } : {}),
        ...(payload.panNumber !== undefined ? { panNumber: payload.panNumber } : {}),
        ...(payload.treasuryWalletAddress !== undefined ? { treasuryWalletAddress: payload.treasuryWalletAddress } : {}),
        ...(payload.supportsBtn !== undefined ? { supportsBtn: payload.supportsBtn } : {}),
        ...(payload.supportsBipsSettlement !== undefined
          ? { supportsBipsSettlement: payload.supportsBipsSettlement }
          : {}),
        ...(payload.isIssuer !== undefined ? { isIssuer: payload.isIssuer } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      },
      include: bankInclude,
    });

    await createAuditLog(actorUserId, id, payload.isActive !== undefined ? AUDIT_ACTIONS.STATUS_CHANGE : AUDIT_ACTIONS.UPDATE, {
      changedFields,
    }, tx);

    return updatedBank;
  });
}

async function createBankAccount(bankId, payload, actorUserId) {
  await getBankOrThrow(bankId);

  return prisma.$transaction(async (tx) => {
    if (payload.isPrimary) {
      await tx.bankAccount.updateMany({
        where: {
          bankId,
          accountType: payload.accountType,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    await tx.bankAccount.create({
      data: {
        bankId,
        accountType: payload.accountType,
        accountName: payload.accountName,
        accountNumber: payload.accountNumber,
        currency: payload.currency || 'BTN',
        isPrimary: payload.isPrimary ?? true,
        isActive: payload.isActive ?? true,
        remarks: payload.remarks || null,
      },
    });

    await createAuditLog(actorUserId, bankId, AUDIT_ACTIONS.CREATE, {
      objectType: 'BANK_ACCOUNT',
      accountType: payload.accountType,
      accountNumber: payload.accountNumber,
      isPrimary: payload.isPrimary ?? true,
    }, tx);

    return getBankOrThrow(bankId, tx);
  });
}

async function updateBankAccount(bankId, accountId, payload, actorUserId) {
  const existingAccount = await getBankAccountOrThrow(bankId, accountId);

  const changedFields = {};
  for (const field of ['accountName', 'accountNumber', 'currency', 'isPrimary', 'isActive', 'remarks']) {
    if (payload[field] !== undefined && payload[field] !== existingAccount[field]) {
      changedFields[field] = {
        previous: existingAccount[field],
        current: payload[field],
      };
    }
  }

  return prisma.$transaction(async (tx) => {
    if (payload.isPrimary === true) {
      await tx.bankAccount.updateMany({
        where: {
          bankId,
          accountType: existingAccount.accountType,
          isPrimary: true,
          NOT: {
            id: accountId,
          },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    await tx.bankAccount.update({
      where: { id: accountId },
      data: {
        ...(payload.accountName !== undefined ? { accountName: payload.accountName } : {}),
        ...(payload.accountNumber !== undefined ? { accountNumber: payload.accountNumber } : {}),
        ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
        ...(payload.isPrimary !== undefined ? { isPrimary: payload.isPrimary } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        ...(payload.remarks !== undefined ? { remarks: payload.remarks } : {}),
      },
    });

    await createAuditLog(actorUserId, bankId, AUDIT_ACTIONS.UPDATE, {
      objectType: 'BANK_ACCOUNT',
      accountId,
      changedFields,
    }, tx);

    return getBankOrThrow(bankId, tx);
  });
}

async function createBankTokenAccount(bankId, payload, actorUserId) {
  await getBankOrThrow(bankId);

  return prisma.$transaction(async (tx) => {
    if (payload.isPrimary) {
      await tx.bankTokenAccount.updateMany({
        where: {
          bankId,
          mintAddress: payload.mintAddress,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    await tx.bankTokenAccount.create({
      data: {
        bankId,
        mintAddress: payload.mintAddress,
        treasuryWalletAddress: payload.treasuryWalletAddress,
        tokenAccountAddress: payload.tokenAccountAddress,
        isPrimary: payload.isPrimary ?? true,
        isActive: payload.isActive ?? true,
        remarks: payload.remarks || null,
      },
    });

    await createAuditLog(actorUserId, bankId, AUDIT_ACTIONS.CREATE, {
      objectType: 'BANK_TOKEN_ACCOUNT',
      mintAddress: payload.mintAddress,
      tokenAccountAddress: payload.tokenAccountAddress,
      treasuryWalletAddress: payload.treasuryWalletAddress,
    }, tx);

    return getBankOrThrow(bankId, tx);
  });
}

async function updateBankTokenAccount(bankId, tokenAccountId, payload, actorUserId) {
  const existingTokenAccount = await getBankTokenAccountOrThrow(bankId, tokenAccountId);

  const changedFields = {};
  for (const field of ['treasuryWalletAddress', 'tokenAccountAddress', 'isPrimary', 'isActive', 'remarks']) {
    if (payload[field] !== undefined && payload[field] !== existingTokenAccount[field]) {
      changedFields[field] = {
        previous: existingTokenAccount[field],
        current: payload[field],
      };
    }
  }

  return prisma.$transaction(async (tx) => {
    if (payload.isPrimary === true) {
      await tx.bankTokenAccount.updateMany({
        where: {
          bankId,
          mintAddress: existingTokenAccount.mintAddress,
          isPrimary: true,
          NOT: {
            id: tokenAccountId,
          },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    await tx.bankTokenAccount.update({
      where: { id: tokenAccountId },
      data: {
        ...(payload.treasuryWalletAddress !== undefined
          ? { treasuryWalletAddress: payload.treasuryWalletAddress }
          : {}),
        ...(payload.tokenAccountAddress !== undefined
          ? { tokenAccountAddress: payload.tokenAccountAddress }
          : {}),
        ...(payload.isPrimary !== undefined ? { isPrimary: payload.isPrimary } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        ...(payload.remarks !== undefined ? { remarks: payload.remarks } : {}),
      },
    });

    await createAuditLog(actorUserId, bankId, AUDIT_ACTIONS.UPDATE, {
      objectType: 'BANK_TOKEN_ACCOUNT',
      tokenAccountId,
      changedFields,
    }, tx);

    return getBankOrThrow(bankId, tx);
  });
}

module.exports = {
  listBanks,
  getBankById,
  updateBank,
  createBankAccount,
  updateBankAccount,
  createBankTokenAccount,
  updateBankTokenAccount,
};
