import { z } from 'zod';

export const createOrderSchema = z
  .object({
    tableNumber: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    customerName: z
      .string()
      .trim()
      .transform((value) => value || null)
      .nullable()
      .optional(),
  })
  .strict();

export const orderIdParamsSchema = z.object({ orderId: z.uuid() }).strict();

export const listOrdersQuerySchema = z
  .object({
    status: z.enum(['DRAFT', 'IN_PREPARATION', 'COMPLETED', 'CANCELLED']).optional(),
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderIdParams = z.infer<typeof orderIdParamsSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
