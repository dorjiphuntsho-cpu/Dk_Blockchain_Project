const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { buildPagination, getPagination, getSortOptions } = require('../utils/pagination');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../utils/enums');
const { managedTokenInclude } = require('../models/managedToken.model');
const auditLogService = require('./auditLog.service');
const solanaService = require('./solana.service');

function getManagedTokenDelegate(client = prisma) {
  if (!client.managedToken) {
    throw new ApiError(
      500,
      'Prisma client is out of date for ManagedToken. Restart the backend so Prisma can regenerate and sync the latest schema.',
    );
  }

  return client.managedToken;
}

async function createManagedTokenRecord(payload, actorUserId, tx = prisma) {
  const managedToken = getManagedTokenDelegate(tx);
  const token = await managedToken.create({
    data: {
      mintAddress: payload.mintAddress,
      decimals: payload.decimals,
      mintAuthority: payload.mintAuthority,
      freezeAuthority: payload.freezeAuthority,
      tokenAuthority: payload.tokenAuthority,
      createdTxSignature: payload.txSignature || null,
      explorerUrl: payload.explorerUrl || null,
      creatorUserId: actorUserId || null,
    },
    include: managedTokenInclude,
  });

  await auditLogService.createAuditLog(
    {
      actorUserId,
      entityType: AUDIT_ENTITY_TYPES.MANAGED_TOKEN,
      entityId: token.id,
      action: AUDIT_ACTIONS.CREATE,
      metadata: {
        mintAddress: token.mintAddress,
        decimals: token.decimals,
        tokenAuthority: token.tokenAuthority,
        createdTxSignature: token.createdTxSignature,
      },
    },
    tx,
  );

  return token;
}

async function listManagedTokens(query) {
  const managedToken = getManagedTokenDelegate();
  const { page, limit, skip } = getPagination(query);
  const orderBy = getSortOptions(query, ['createdAt', 'updatedAt', 'mintAddress', 'decimals'], { createdAt: 'desc' });

  const where = {
    ...(query.search
      ? {
          OR: [
            {
              mintAddress: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
            {
              tokenAuthority: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
  };

  const [items, totalItems] = await prisma.$transaction([
    managedToken.findMany({
      where,
      include: managedTokenInclude,
      orderBy,
      skip,
      take: limit,
    }),
    managedToken.count({ where }),
  ]);

  const hydratedItems = await Promise.all(items.map((item) => solanaService.hydrateManagedToken(item)));

  return {
    items: hydratedItems,
    pagination: buildPagination({ page, limit, totalItems }),
  };
}

async function getManagedTokenById(id) {
  const managedToken = getManagedTokenDelegate();
  const token = await managedToken.findUnique({
    where: { id },
    include: managedTokenInclude,
  });

  if (!token) {
    throw new ApiError(404, 'Managed token not found');
  }

  return solanaService.hydrateManagedToken(token);
}

module.exports = {
  createManagedTokenRecord,
  getManagedTokenById,
  listManagedTokens,
};
