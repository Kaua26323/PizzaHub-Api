import { beforeEach, describe, expect, it } from 'vitest';

import { admin, createDraft, creatorId, database, seedActor } from '../helpers/order-api';

beforeEach(seedActor);

describe('POST /orders', () => {
  it('creates an empty DRAFT order for STAFF with the actor as creator', async () => {
    const id = await createDraft(7, { customerName: '  Ava  ' });

    const result = await database().query('SELECT * FROM orders WHERE id = $1', [id]);
    expect(result.rows[0]).toMatchObject({
      id,
      table_number: 7,
      customer_name: 'Ava',
      status: 'DRAFT',
      created_by_user_id: creatorId(),
      submitted_at: null,
      completed_at: null,
      cancelled_at: null,
    });
    expect(result.rows[0].created_at).toBeInstanceOf(Date);
  });

  it('allows ADMIN to create an order and normalizes a blank customer name', async () => {
    const id = await createDraft(8, {
      authorization: admin(),
      customerName: '   ',
    });

    const result = await database().query(
      'SELECT customer_name, created_by_user_id FROM orders WHERE id = $1',
      [id],
    );
    expect(result.rows[0]).toEqual({
      customer_name: null,
      created_by_user_id: creatorId('ADMIN'),
    });
  });

  it('stores an omitted customer name as null', async () => {
    const id = await createDraft(9);
    const result = await database().query(
      'SELECT customer_name FROM orders WHERE id = $1',
      [id],
    );
    expect(result.rows[0].customer_name).toBeNull();
  });
});
