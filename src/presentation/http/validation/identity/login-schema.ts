import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email('Invalid email format')),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
