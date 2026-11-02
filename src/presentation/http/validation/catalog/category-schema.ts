import { z } from 'zod';

export const categoryBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Name category cannot be empty.'),
  })
  .strict();

export const categoryIdParamsSchema = z.object({ categoryId: z.uuid() }).strict();

export type CategoryInput = z.infer<typeof categoryBodySchema>;
export type CategoryIdParams = z.infer<typeof categoryIdParamsSchema>;
