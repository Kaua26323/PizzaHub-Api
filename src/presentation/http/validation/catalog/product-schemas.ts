import { z } from 'zod';

const productFields = {
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  price: z
    .string()
    .regex(/^(0|[1-9]\d*)\.\d{2}$/, 'Price must be a decimal amount with two places.'),
  categoryId: z.uuid(),
};

export const createProductSchema = z
  .object({
    ...productFields,
    isActive: z.enum(['true', 'false']).transform((value) => value === 'true'),
  })
  .strict();

export const updateProductSchema = z.object(productFields).partial().strict();

export const changeProductStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const productIdParamsSchema = z.object({ productId: z.uuid() }).strict();

export const listProductsQuerySchema = z
  .object({ categoryId: z.uuid().optional() })
  .strict();
