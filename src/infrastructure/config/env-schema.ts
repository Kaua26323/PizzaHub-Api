import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  WEB_ORIGIN: z.url({
    protocol: /^https?$/,
    error: 'WEB_ORIGIN must be a valid HTTP/HTTPS URL',
  }),
  DATABASE_URL: z.url({
    protocol: /^postgres(?:ql)?$/,
    error: 'DATABASE_URL must be a valid PostgreSQL URL',
  }),

  JWT_ISSUER: z.string().trim().min(1, 'JWT_ISSUER is required'),
  JWT_AUDIENCE: z.string().trim().min(1, 'JWT_AUDIENCE is required'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long'),

  UPLOAD_DIRECTORY: z
    .string()
    .trim()
    .min(1, 'UPLOAD_DIRECTORY is required')
    .default('uploads/products'),
  UPLOAD_TEMP_DIRECTORY: z
    .string()
    .trim()
    .min(1, 'UPLOAD_TEMP_DIRECTORY is required')
    .default('uploads/tmp/products'),
  MAX_UPLOAD_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .max(5_242_880, 'MAX_UPLOAD_SIZE cannot exceed 5 MiB')
    .default(5_242_880),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    console.error(z.prettifyError(result.error));
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}
