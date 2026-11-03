import { z } from 'zod';

export const orderItemNotesSchema = z
  .string()
  .trim()
  .max(500)
  .transform((value) => value || null)
  .nullable();

const quantitySchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const addOrderItemSchema = z
  .object({
    productId: z.uuid(),
    quantity: quantitySchema,
    notes: orderItemNotesSchema.optional(),
  })
  .strict();

export const updateOrderItemSchema = z
  .object({
    quantity: quantitySchema.optional(),
    notes: orderItemNotesSchema.optional(),
  })
  .strict()
  .refine((value) => value.quantity !== undefined || value.notes !== undefined, {
    message: 'At least one item field is required.',
  });

export const orderItemIdParamsSchema = z
  .object({ orderId: z.uuid(), itemId: z.uuid() })
  .strict();
