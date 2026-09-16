import { Pool } from 'pg';
import { env } from '@/infrastructure/config/env';

const pool = new Pool({
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === 'production' ? 20 : 5,
});

export { pool };
