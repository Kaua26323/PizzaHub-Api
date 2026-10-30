import { z } from 'zod';

export const userIdParamsSchema = z.object({ userId: z.uuid() }).strict();

export const changeUserRoleSchema = z
  .object({ role: z.enum(['ADMIN', 'STAFF']) })
  .strict();

export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
