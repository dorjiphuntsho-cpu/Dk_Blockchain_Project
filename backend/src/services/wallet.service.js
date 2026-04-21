const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { buildPagination, getPagination, getSortOptions } = require('../utils/pagination');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../utils/enums');
const { walletInclude } = require('../models/wallet.model');
const auditLogService = require('./auditLog.service');

async function ensureUserExists(userId, tx = prisma) {
  const user = await tx.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }
}

async function createWallet(payload, actorUserId) {
  await ensureUserExists(payload.userId);

  const wallet = await prisma.$transaction(async (tx) => {
    if (payload.isPrimary) {
      await tx.wallet.updateMany({
        where: {
          userId: payload.userId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const createdWallet = await tx.wallet.create({
      data: {
        userId: payload.userId,
        walletAddress: payload.walletAddress,
        label: payload.label,
        isPrimary: payload.isPrimary || false,
      },
      include: walletInclude,
    });

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.WALLET,
        entityId: createdWallet.id,
        action: AUDIT_ACTIONS.CREATE,
        metadata: {
          userId: createdWallet.userId,
          walletAddress: createdWallet.walletAddress,
          isPrimary: createdWallet.isPrimary,
        },
      },
      tx,
    );

    return createdWallet;
  });

  return wallet;
}

async function listWallets(query) {
  const { page, limit, skip } = getPagination(query);
  const orderBy = getSortOptions(query, ['createdAt', 'updatedAt', 'walletAddress'], { createdAt: 'desc' });

  const where = {
    ...(query.userId ? { userId: query.userId } : {}),
    ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
    ...(typeof query.isPrimary === 'boolean' ? { isPrimary: query.isPrimary } : {}),
    ...(query.walletAddress
      ? {
          walletAddress: {
            contains: query.walletAddress,
            mode: 'insensitive',
          },
        }
      : {}),
  };

  const [items, totalItems] = await prisma.$transaction([
    prisma.wallet.findMany({
      where,
      include: walletInclude,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.wallet.count({ where }),
  ]);

  return {
    items,
    pagination: buildPagination({ page, limit, totalItems }),
  };
}

async function getWalletById(id) {
  const wallet = await prisma.wallet.findUnique({
    where: { id },
    include: walletInclude,
  });

  if (!wallet) {
    throw new ApiError(404, 'Wallet not found');
  }

  return wallet;
}

async function updateWallet(id, payload, actorUserId) {
  const existingWallet = await prisma.wallet.findUnique({
    where: { id },
    include: walletInclude,
  });

  if (!existingWallet) {
    throw new ApiError(404, 'Wallet not found');
  }

  const nextUserId = payload.userId || existingWallet.userId;
  await ensureUserExists(nextUserId);

  const changedFields = {};
  for (const field of ['userId', 'walletAddress', 'label', 'isPrimary']) {
    if (payload[field] !== undefined && payload[field] !== existingWallet[field]) {
      changedFields[field] = {
        previous: existingWallet[field],
        current: payload[field],
      };
    }
  }

  const wallet = await prisma.$transaction(async (tx) => {
    if (payload.isPrimary === true) {
      await tx.wallet.updateMany({
        where: {
          userId: nextUserId,
          isPrimary: true,
          NOT: {
            id,
          },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const updatedWallet = await tx.wallet.update({
      where: { id },
      data: {
        ...(payload.userId !== undefined ? { userId: payload.userId } : {}),
        ...(payload.walletAddress !== undefined ? { walletAddress: payload.walletAddress } : {}),
        ...(payload.label !== undefined ? { label: payload.label } : {}),
        ...(payload.isPrimary !== undefined ? { isPrimary: payload.isPrimary } : {}),
      },
      include: walletInclude,
    });

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.WALLET,
        entityId: id,
        action: AUDIT_ACTIONS.UPDATE,
        metadata: {
          changedFields,
        },
      },
      tx,
    );

    return updatedWallet;
  });

  return wallet;
}

async function updateWalletStatus(id, isActive, actorUserId) {
  const existingWallet = await prisma.wallet.findUnique({
    where: { id },
  });

  if (!existingWallet) {
    throw new ApiError(404, 'Wallet not found');
  }

  const wallet = await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: { id },
      data: { isActive },
      include: walletInclude,
    });

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.WALLET,
        entityId: id,
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        metadata: {
          previousStatus: existingWallet.isActive,
          newStatus: isActive,
        },
      },
      tx,
    );

    return updatedWallet;
  });

  return wallet;
}

module.exports = {
  createWallet,
  listWallets,
  getWalletById,
  updateWallet,
  updateWalletStatus,
};
