const {
  optionalBooleanFromUnknown,
  optionalEnumQuerySchema,
  optionalTrimmedQueryString,
  requiredTrimmedString,
  uuidSchema,
  z,
} = require('../utils/validation');

const roleEnum = z.enum(['ADMIN', 'MAKER', 'CHECKER', 'EXECUTOR']);

const createUserSchema = z.object({
  body: z.object({
    fullName: requiredTrimmedString.min(3, 'Full name must be at least 3 characters'),
    email: requiredTrimmedString.email('Invalid email format'),
    password: requiredTrimmedString.min(8, 'Password must be at least 8 characters'),
    cid: requiredTrimmedString.regex(/^\d{11}$/, 'CID must be 11 digits').optional(),
    customerType: requiredTrimmedString.optional(),
    linkedBankAccountNumber: requiredTrimmedString.optional(),
    linkedBankAccountNumbers: z.array(requiredTrimmedString).optional(),
    mpin: requiredTrimmedString.regex(/^\d{4,6}$/, 'MPIN must be 4 to 6 digits').optional(),
    roles: z
      .array(roleEnum)
      .optional()
      .default([])
      .refine((roles) => new Set(roles).size === roles.length, {
        message: 'Duplicate roles are not allowed',
      }),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const listUsersQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    search: optionalTrimmedQueryString,
    isActive: optionalBooleanFromUnknown,
    sortBy: optionalEnumQuerySchema(z.enum(['fullName', 'email', 'createdAt', 'updatedAt'])),
    sortOrder: optionalEnumQuerySchema(z.enum(['asc', 'desc'])),
  }),
});

const userIdParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const updateUserSchema = z.object({
  body: z
    .object({
      fullName: requiredTrimmedString.min(3).optional(),
      email: requiredTrimmedString.email('Invalid email format').optional(),
      password: requiredTrimmedString.min(8, 'Password must be at least 8 characters').optional(),
      cid: requiredTrimmedString.regex(/^\d{11}$/, 'CID must be 11 digits').nullable().optional(),
      customerType: requiredTrimmedString.nullable().optional(),
      linkedBankAccountNumber: requiredTrimmedString.nullable().optional(),
      linkedBankAccountNumbers: z.array(requiredTrimmedString).optional(),
      mpin: requiredTrimmedString.regex(/^\d{4,6}$/, 'MPIN must be 4 to 6 digits').optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const updateUserStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

const assignRolesSchema = z.object({
  body: z.object({
    roles: z
      .array(roleEnum)
      .min(1, 'At least one role is required')
      .refine((roles) => new Set(roles).size === roles.length, {
        message: 'Duplicate roles are not allowed',
      }),
  }),
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({}).optional(),
});

module.exports = {
  createUserSchema,
  listUsersQuerySchema,
  userIdParamSchema,
  updateUserSchema,
  updateUserStatusSchema,
  assignRolesSchema,
};
