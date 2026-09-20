import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

import { env } from '@/infrastructure/config/env';
import { runMigrations } from '@/infrastructure/database/postgres/migrations/run-migrations';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

const migrationsDirectory = path.resolve(currentDirectory, '../database/migrations');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

try {
  await runMigrations(pool, {
    migrationsDirectory,
  });
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown migration error.';

  console.error(`Migration execution failed: ${message}`);

  process.exitCode = 1;
} finally {
  await pool.end();
}
