const prisma = require('../config/prisma');
const { buildPagination, getPagination, getSortOptions } = require('../utils/pagination');

async function createAuditLog({ actorUserId = null, entityType, entityId, action, metadata = {} }, tx = prisma) {
  return tx.auditLog.create({
    data: {
      actorUserId,
      entityType,
      entityId,
      action,
      metadata,
    },
  });
}

async function listAuditLogs(query) {
  const { page, limit, skip } = getPagination(query);
  const orderBy = getSortOptions(query, ['createdAt', 'entityType', 'action'], { createdAt: 'desc' });

  const where = {
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...((query.dateFrom || query.dateTo)
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
          },
        }
      : {}),
  };

  const [items, totalItems] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        actorUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    pagination: buildPagination({ page, limit, totalItems }),
  };
}

module.exports = {
  createAuditLog,
  listAuditLogs,
};
