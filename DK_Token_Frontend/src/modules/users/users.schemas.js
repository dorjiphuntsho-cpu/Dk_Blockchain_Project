import { z } from 'zod';

const roleOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const userCreateSchema = z.object({
  fullName: z.string().trim().min(3, 'Full name is required'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roles: z.array(roleOptionSchema).optional().default([]),
});

export const userUpdateSchema = userCreateSchema.partial().extend({
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});
