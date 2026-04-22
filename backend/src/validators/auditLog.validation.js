const {
  optionalEnumQuerySchema,
  optionalTrimmedQueryString,
  optionalUuidQuerySchema,
  z,
} = require('../utils/validation');

const auditLogListQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    entityType: optionalTrimmedQueryString,
    entityId: optionalTrimmedQueryString,
    actorUserId: optionalUuidQuerySchema,
    action: optionalTrimmedQueryString,
    dateFrom: optionalTrimmedQueryString,
    dateTo: optionalTrimmedQueryString,
    sortBy: optionalEnumQuerySchema(z.enum(['createdAt', 'entityType', 'action'])),
    sortOrder: optionalEnumQuerySchema(z.enum(['asc', 'desc'])),
  }),
});

module.exports = {
  auditLogListQuerySchema,
};
