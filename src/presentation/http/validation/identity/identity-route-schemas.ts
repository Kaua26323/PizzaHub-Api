import { z } from 'zod';

// These routes accept no JSON fields. An omitted body is valid.
export const emptyIdentityBodySchema = z.object({}).strict().optional();

export const refreshSchema = emptyIdentityBodySchema;
export const logoutSchema = emptyIdentityBodySchema;
export const logoutAllSchema = emptyIdentityBodySchema;
export const profileSchema = emptyIdentityBodySchema;
export const listUsersSchema = emptyIdentityBodySchema;
export const emptyIdentityQuerySchema = z.object({}).strict();

export const userIdParamsSchema = z.object({ userId: z.uuid() }).strict();

export const changeUserRoleSchema = z
  .object({ role: z.enum(['ADMIN', 'STAFF']) })
  .strict();

export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
