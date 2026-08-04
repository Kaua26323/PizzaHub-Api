import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';

import { Pool, type PoolClient } from 'pg';

import { env } from '@/infrastructure/config/env';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

const migrationsDirectory = path.resolve(currentDirectory, '../database/migrations');
const migrationFilenamePattern = /^\d{3}_[a-z0-9][a-z0-9_-]*\.sql$/i;

interface AppliedMigrationRow {
  filename: string;
}

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations(
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function findMigrationFiles(): Promise<string[]> {
  const directoryEntries = await readdir(migrationsDirectory, {
    withFileTypes: true,
  });

  const migrationFiles = directoryEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((filename) => filename.endsWith('.sql'));

  for (const filename of migrationFiles) {
    if (!migrationFilenamePattern.test(filename)) {
      throw new Error(
        `Invalid migration filename: "${filename}".` +
          'Expected a name such  as "001_create_users.sql"',
      );
    }
  }

  return migrationFiles.sort((first, second) => first.localeCompare(second, 'en'));
}

async function findAppliedMigrations(client: PoolClient): Promise<Set<string>> {
  const result = await client.query<AppliedMigrationRow>(`
    SELECT filename
    FROM schema_migrations 
    ORDER BY filename
  `);

  return new Set(result.rows.map((migration) => migration.filename));
}

async function executeMigration(client: PoolClient, filename: string) {
  const migrationPath = path.join(migrationsDirectory, filename);
  const migrationSql = await readFile(migrationPath, 'utf-8');

  if (migrationSql.trim().length === 0) {
    throw new Error(`Migration ${filename} is empty.`);
  }

  await client.query('BEGIN');

  try {
    await client.query(migrationSql);
    await client.query(
      `
        INSERT INTO schema_migrations (filename)
        VALUES ($1);

      `,
      [filename],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Migration ${filename} failed.`, { cause: error });
  }
}

async function runMigrations(): Promise<void> {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();

    try {
      await ensureMigrationsTable(client);
      const migrationFiles = await findMigrationFiles();
      const appliedMigrations = await findAppliedMigrations(client);

      const pendingMigrations = migrationFiles.filter(
        (filename) => !appliedMigrations.has(filename),
      );

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations.');
        return;
      }

      console.log(`Found ${pendingMigrations.length} peding migration(s).`);

      for (const filename of pendingMigrations) {
        console.log(`Applying ${filename}...`);

        await executeMigration(client, filename);

        console.log(`Applied ${filename}.`);
      }
      console.log('All migrations were applied successfully.');
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown migration error.';

  console.error(`Migration execution failed: ${message}`);

  process.exitCode = 1;
});
