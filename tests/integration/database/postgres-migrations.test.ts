import { Pool } from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';

import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';

import { testPool } from '@tests/setup/postgres';
import { env } from '@/infrastructure/config/env';
import { runMigrations } from '@/infrastructure/database/postgres/migrations/run-migrations';

const migrationsDirectory = fileURLToPath(
  new URL('../../../database/migrations/', import.meta.url),
);

const userId = '10000000-0000-4000-8000-000000000001';
const categoryId = '20000000-0000-4000-8000-000000000001';
const productId = '30000000-0000-4000-8000-000000000001';
const orderId = '40000000-0000-4000-8000-000000000001';
const itemId = '50000000-0000-4000-8000-000000000001';
const sessionId = '60000000-0000-4000-8000-000000000001';
const missingId = '90000000-0000-4000-8000-000000000001';

async function withIsolatedSchema(run: (pool: Pool) => Promise<void>): Promise<void> {
  const schema = `t88_${randomUUID().replaceAll('-', '')}`;

  await testPool.query(`CREATE SCHEMA ${schema}`);

  const isolatedPool = new Pool({
    connectionString: env.DATABASE_URL,
    options: `-c search_path=${schema}`,
  });

  try {
    await run(isolatedPool);
  } finally {
    await isolatedPool.end();
    await testPool.query(`DROP SCHEMA ${schema} CASCADE`);
  }
}

async function seedRows(): Promise<void> {
  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES ($1, 'Test User', 'user@example.com', 'hash', 'STAFF')`,
    [userId],
  );
  await testPool.query(`INSERT INTO categories (id, name) VALUES ($1, 'Pizzas')`, [
    categoryId,
  ]);
  await testPool.query(
    `INSERT INTO products
       (id, name, description, price, image_key, image_mime_type,
        image_size, is_active, category_id)
     VALUES ($1, 'Pizza', 'Test pizza', '49.90', 'products/pizza.webp',
             'image/webp', 1024, true, $2)`,
    [productId, categoryId],
  );
  await testPool.query(
    `INSERT INTO orders (id, table_number, created_by_user_id)
     VALUES ($1, 1, $2)`,
    [orderId, userId],
  );
  await testPool.query(
    `INSERT INTO order_items
       (id, order_id, product_id, product_name, unit_price, quantity)
     VALUES ($1, $2, $3, 'Pizza', '49.90', 1)`,
    [itemId, orderId, productId],
  );
  await testPool.query(
    `INSERT INTO auth_sessions
       (id, user_id, token_family_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, $1, 'hash:first', '2030-01-01T00:00:00Z')`,
    [sessionId, userId],
  );
}

async function expectRejectedUpdate(
  table: string,
  id: string,
  column: string,
  value: unknown,
  code: string,
  constraint?: string,
): Promise<void> {
  await expect(
    // Safe here because table and column come only from static test cases.
    testPool.query(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, [value, id]),
  ).rejects.toMatchObject({ code, ...(constraint ? { constraint } : {}) });
}

describe('PostgreSQL migrations', () => {
  it('applies every migration in order and skips them on a second run', async () => {
    await withIsolatedSchema(async (pool) => {
      const filenames = (await readdir(migrationsDirectory))
        .filter((filename) => /^\d{3}_[a-z0-9_-]+\.sql$/i.test(filename))
        .sort();

      await runMigrations(pool, { migrationsDirectory });

      const firstRun = await pool.query<{
        filename: string;
        applied_at: Date;
      }>('SELECT filename, applied_at FROM schema_migrations ORDER BY filename');

      expect(firstRun.rows.map((row) => row.filename)).toEqual(filenames);

      const tables = await pool.query<{ tablename: string }>(
        'SELECT tablename FROM pg_tables WHERE schemaname = current_schema()',
      );

      expect(tables.rows.map((row) => row.tablename)).toEqual(
        expect.arrayContaining([
          'users',
          'auth_sessions',
          'categories',
          'products',
          'orders',
          'order_items',
          'schema_migrations',
        ]),
      );

      await runMigrations(pool, { migrationsDirectory });

      const secondRun = await pool.query<{
        filename: string;
        applied_at: Date;
      }>('SELECT filename, applied_at FROM schema_migrations ORDER BY filename');

      expect(secondRun.rows).toEqual(firstRun.rows);
    });
  });

  it('rolls back a failed migration without recording it as applied', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'pizzahub-migrations-'));

    try {
      await writeFile(
        path.join(directory, '001_create_probe.sql'),
        'CREATE TABLE migration_probe (id INTEGER PRIMARY KEY);',
      );
      await writeFile(
        path.join(directory, '002_fail_after_create.sql'),
        'CREATE TABLE rolled_back_probe (id INTEGER); SELECT * FROM missing_table;',
      );

      await withIsolatedSchema(async (pool) => {
        await expect(
          runMigrations(pool, { migrationsDirectory: directory }),
        ).rejects.toThrow('Migration "002_fail_after_create.sql" failed.');

        const result = await pool.query<{ filename: string }>(
          'SELECT filename FROM schema_migrations ORDER BY filename',
        );
        expect(result.rows.map((row) => row.filename)).toEqual(['001_create_probe.sql']);

        const tables = await pool.query<{ tablename: string }>(
          'SELECT tablename FROM pg_tables WHERE schemaname = current_schema()',
        );
        expect(tables.rows.map((row) => row.tablename)).toContain('migration_probe');
        expect(tables.rows.map((row) => row.tablename)).not.toContain(
          'rolled_back_probe',
        );
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('PostgreSQL migration constraints', () => {
  beforeEach(seedRows);

  it.each(
    (
      [
        ['users', userId, 'name', '  ', 'users_name_not_blank'],
        ['users', userId, 'email', ' ', 'users_email_not_blank'],
        ['users', userId, 'password_hash', '', 'users_password_hash_not_blank'],
        ['users', userId, 'role', 'MANAGER', 'users_role_valid'],
        ['categories', categoryId, 'name', ' ', 'categories_name_not_blank'],
        ['products', productId, 'name', ' ', 'products_name_not_blank'],
        ['products', productId, 'description', '', 'products_description_not_blank'],
        ['products', productId, 'price', '0.00', 'products_price_must_be_valid'],
        ['products', productId, 'price', '49.9', 'products_price_must_be_valid'],
        ['products', productId, 'image_key', ' ', 'products_image_key_not_blank'],
        [
          'products',
          productId,
          'image_mime_type',
          'image/gif',
          'products_image_mime_type_must_be_valid',
        ],
        [
          'products',
          productId,
          'image_size',
          0,
          'products_image_size_must_be_greater_than_zero',
        ],
        ['orders', orderId, 'table_number', 0, 'orders_table_number_must_be_valid'],
        ['orders', orderId, 'status', 'UNKNOWN', 'orders_status_must_be_valid'],
        [
          'order_items',
          itemId,
          'product_name',
          ' ',
          'order_items_product_name_not_blank',
        ],
        [
          'order_items',
          itemId,
          'unit_price',
          '0.00',
          'order_items_unit_price_must_be_valid',
        ],
        [
          'order_items',
          itemId,
          'quantity',
          0,
          'order_items_quantity_must_be_greater_than_zero',
        ],
        [
          'auth_sessions',
          sessionId,
          'refresh_token_hash',
          ' ',
          'auth_sessions_refresh_token_hash_not_blank',
        ],
      ] as const
    ).map(([table, id, column, value, constraint]) => ({
      table,
      id,
      column,
      value,
      constraint,
    })),
  )(
    'rejects an invalid $table.$column value',
    async ({ table, id, column, value, constraint }) => {
      await expectRejectedUpdate(table, id, column, value, '23514', constraint);
    },
  );

  it.each(
    (
      [
        ['products', productId, 'name', 'x'.repeat(81)],
        ['products', productId, 'description', 'x'.repeat(501)],
        ['order_items', itemId, 'product_name', 'x'.repeat(81)],
        ['order_items', itemId, 'notes', 'x'.repeat(501)],
      ] as const
    ).map(([table, id, column, value]) => ({ table, id, column, value })),
  )('rejects an oversized $table.$column value', async ({ table, id, column, value }) => {
    await expectRejectedUpdate(table, id, column, value, '22001');
  });

  it.each(
    (
      [
        ['users', userId, 'email'],
        ['categories', categoryId, 'name'],
        ['products', productId, 'price'],
        ['orders', orderId, 'created_by_user_id'],
        ['order_items', itemId, 'quantity'],
        ['auth_sessions', sessionId, 'expires_at'],
      ] as const
    ).map(([table, id, column]) => ({ table, id, column })),
  )('rejects a null required value in $table.$column', async ({ table, id, column }) => {
    await expectRejectedUpdate(table, id, column, null, '23502');
  });

  it.each(
    (
      [
        ['products', productId, 'category_id', 'products_category_id_fk'],
        ['orders', orderId, 'created_by_user_id', 'orders_created_by_user_fk'],
        ['order_items', itemId, 'order_id', 'order_items_order_id_fk'],
        ['order_items', itemId, 'product_id', 'order_items_product_id_fk'],
        ['auth_sessions', sessionId, 'user_id', 'auth_sessions_user_fk'],
      ] as const
    ).map(([table, id, column, constraint]) => ({ table, id, column, constraint })),
  )(
    'rejects an invalid $table.$column reference',
    async ({ table, id, column, constraint }) => {
      await expectRejectedUpdate(table, id, column, missingId, '23503', constraint);
    },
  );

  it('rejects duplicate refresh token hashes', async () => {
    await expect(
      testPool.query(
        `INSERT INTO auth_sessions
           (id, user_id, token_family_id, refresh_token_hash, expires_at)
         VALUES ($1, $2, $1, 'hash:first', '2030-01-01T00:00:00Z')`,
        [missingId, userId],
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'auth_sessions_refresh_token_hash_key',
    });
  });

  it('rejects duplicate product image keys', async () => {
    await expect(
      testPool.query(
        `INSERT INTO products
           (id, name, description, price, image_key, image_mime_type,
            image_size, is_active, category_id)
         VALUES ($1, 'Another Pizza', 'Another test pizza', '39.90',
                 'products/pizza.webp', 'image/webp', 512, true, $2)`,
        [missingId, categoryId],
      ),
    ).rejects.toMatchObject({ code: '23505', constraint: 'products_image_key_key' });
  });

  it('allows only one active session per token family', async () => {
    await expect(
      testPool.query(
        `INSERT INTO auth_sessions
           (id, user_id, token_family_id, refresh_token_hash, expires_at)
         VALUES ($1, $2, $3, 'hash:second', '2030-01-01T00:00:00Z')`,
        [missingId, userId, sessionId],
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'auth_sessions_one_active_per_family_idx',
    });

    await testPool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1', [
      sessionId,
    ]);
    await testPool.query(
      `INSERT INTO auth_sessions
         (id, user_id, token_family_id, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3, 'hash:second', '2030-01-01T00:00:00Z')`,
      [missingId, userId, sessionId],
    );

    const result = await testPool.query<{ revoked_at: Date | null }>(
      'SELECT revoked_at FROM auth_sessions WHERE token_family_id = $1 ORDER BY created_at, id',
      [sessionId],
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows.filter((row) => row.revoked_at === null)).toHaveLength(1);
  });

  it('rejects deletion of referenced categories and products', async () => {
    await expect(
      testPool.query('DELETE FROM categories WHERE id = $1', [categoryId]),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      testPool.query('DELETE FROM products WHERE id = $1', [productId]),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('allows distinct order items for the same product', async () => {
    await testPool.query(
      `INSERT INTO order_items
         (id, order_id, product_id, product_name, unit_price, quantity)
       VALUES ($1, $2, $3, 'Pizza', '49.90', 2)`,
      [missingId, orderId, productId],
    );

    const result = await testPool.query<{ id: string }>(
      'SELECT id FROM order_items WHERE order_id = $1 AND product_id = $2',
      [orderId, productId],
    );
    expect(result.rows.map((row) => row.id).sort()).toEqual([itemId, missingId].sort());
  });
});
