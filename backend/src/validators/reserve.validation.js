const {
  optionalEnumQuerySchema,
  optionalTrimmedQueryString,
  optionalUuidQuerySchema,
  requiredTrimmedString,
  uuidSchema,
  z,
} = require('../utils/validation');

const reserveStatusEnum = z.enum(['PENDING', 'APPROVED', 'LOCKED', 'CONSUMED', 'RELEASED', 'REJECTED']);

const listReservesQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    bankId: optionalUuidQuerySchema,
    status: optionalEnumQuerySchema(reserveStatusEnum),
    referenceType: optionalTrimmedQueryString,
    sortBy: optionalEnumQuerySchema(z.enum(['createdAt', 'updatedAt', 'approvedAt', 'amount', 'availableAmount'])),
    sortOrder: optionalEnumQuerySchema(z.enum(['asc', 'desc'])),
  }),
});

const reserveIdParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const rejectReserveSchema = z.object({
  body: z.object({
    rejectionReason: requiredTrimmedString,
  }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

module.exports = {
  listReservesQuerySchema,
  reserveIdParamSchema,
  rejectReserveSchema,
};
