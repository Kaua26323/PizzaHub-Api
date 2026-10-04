import type { Pool, PoolClient } from 'pg';

type TransactionCallback<T> = (client: PoolClient) => Promise<T>;

async function withTransaction<T>(
  pool: Pool,
  callback: TransactionCallback<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');

    throw error;
  } finally {
    client.release();
  }
}

export { withTransaction };
