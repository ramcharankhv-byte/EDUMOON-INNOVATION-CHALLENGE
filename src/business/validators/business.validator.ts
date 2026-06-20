import { z } from 'zod';

// Prisma's Industry enum is the source of truth; mirror it here for runtime validation.
export const INDUSTRIES = [
  'ECOMMERCE',
  'SAAS',
  'AGENCY',
  'EDUCATION',
  'CONSULTING',
  'LOCAL_BUSINESS',
  'OTHER',
] as const;

const industrySchema = z.enum(INDUSTRIES);

export const createBusinessSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  description: z.string().max(2000).optional(),
  websiteUrl: z.string().url('Invalid URL').optional(),
  industry: industrySchema,
  contactEmail: z.string().email('Invalid email address').optional(),
  contactPhone: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
});

export const updateBusinessSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().max(2000).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  industry: industrySchema.optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const listBusinessesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  industry: industrySchema.optional(),
  name: z.string().min(1).optional(),
  isActive: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
});

export const businessValidators = {
  create: createBusinessSchema,
  update: updateBusinessSchema,
  listQuery: listBusinessesQuerySchema,
};
