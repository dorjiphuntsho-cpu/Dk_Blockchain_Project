const { z } = require('../utils/validation');

const auditLogListQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    entityType: z.string().trim().optional(),
    entityId: z.string().trim().optional(),
    actorUserId: z.string().uuid().optional(),
    action: z.string().trim().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.enum(['createdAt', 'entityType', 'action']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

module.exports = {
  auditLogListQuerySchema,
};
