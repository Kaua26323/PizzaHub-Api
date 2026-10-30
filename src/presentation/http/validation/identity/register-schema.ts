import { z } from 'zod';

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty'),
    email: z.string().trim().toLowerCase().pipe(z.email('Invalid email format')),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(50, 'Password must be at most 50 characters long'),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
