const { optionalTrimmedQueryString, uuidSchema, z } = require('../utils/validation');

const emptyObjectSchema = z.object({}).optional();

const listManagedTokensQuerySchema = z.object({
  body: emptyObjectSchema,
  params: emptyObjectSchema,
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    search: optionalTrimmedQueryString,
    sortBy: z.enum(['createdAt', 'updatedAt', 'mintAddress', 'decimals']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const managedTokenIdParamSchema = z.object({
  body: emptyObjectSchema,
  params: z.object({
    id: uuidSchema,
  }),
  query: emptyObjectSchema,
});

module.exports = {
  listManagedTokensQuerySchema,
  managedTokenIdParamSchema,
};
