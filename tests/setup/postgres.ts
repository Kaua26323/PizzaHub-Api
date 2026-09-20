import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { env } from '@/infrastructure/config/env';
import { runMigrations } from '@/infrastructure/database/postgres/migrations/run-migrations';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

const databaseDirectory = path.resolve(currentDirectory, '../../database/migrations');

function assertSafeTestDatabase(): void {
  const databaseUrl = new URL(env.DATABASE_URL);
  const databaseName = databaseUrl.pathname.slice(1);

  if (env.NODE_ENV !== 'test' || !databaseName.endsWith('_test')) {
    throw new Error(`Refusing to modify non-test database "${databaseName}".`);
  }
}

async function cleanDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      order_items,
      auth_sessions,
      orders,
      products,
      categories,
      users
    RESTART IDENTITY CASCADE
  `);
}

beforeAll(async () => {
  assertSafeTestDatabase();
  await runMigrations(pool, { migrationsDirectory: databaseDirectory });
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await pool.end();
});

export { cleanDatabase, pool as testPool };
