import { beforeEach, describe, expect, it } from 'vitest';

import {
  addItem,
  api,
  createDraft,
  database,
  seedActor,
  seedProduct,
  staff,
} from '../helpers/order-api';

beforeEach(seedActor);

describe('order item HTTP workflow', () => {
  it('keeps repeated products as distinct items with quantity, notes, and price snapshots', async () => {
    const productId = await seedProduct();
    const orderId = await createDraft(10);

    await addItem(orderId, productId, 2, '  No onions  ');
    await addItem(orderId, productId, 1, 'Extra onions');

    const response = await api()
      .get(`/orders/${orderId}`)
      .set('Authorization', staff())
      .expect(200);
    const items = response.body.data.items;
    expect(items).toHaveLength(2);
    expect(new Set(items.map((item: { id: string }) => item.id)).size).toBe(2);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId,
          productName: 'Calabresa',
          unitPrice: '49.90',
          quantity: 2,
          subtotal: '99.80',
          notes: 'No onions',
        }),
        expect.objectContaining({
          productId,
          productName: 'Calabresa',
          unitPrice: '49.90',
          quantity: 1,
          subtotal: '49.90',
          notes: 'Extra onions',
        }),
      ]),
    );
    expect(response.body.data.total).toBe('149.70');
    const persisted = await database().query(
      'SELECT id, notes FROM order_items WHERE order_id = $1',
      [orderId],
    );
    expect(persisted.rows).toHaveLength(2);
    expect(persisted.rows.map((row) => row.notes).sort()).toEqual([
      'Extra onions',
      'No onions',
    ]);
  });

  it('preserves historical product name and price after catalog changes', async () => {
    const productId = await seedProduct();
    const orderId = await createDraft(11);
    await addItem(orderId, productId, 2);

    await database().query('UPDATE products SET name = $1, price = $2 WHERE id = $3', [
      'Renamed pizza',
      '60.00',
      productId,
    ]);

    const response = await api()
      .get(`/orders/${orderId}`)
      .set('Authorization', staff())
      .expect(200);
    expect(response.body.data.items[0]).toMatchObject({
      productName: 'Calabresa',
      unitPrice: '49.90',
      subtotal: '99.80',
      notes: null,
    });
  });

  it('normalizes whitespace notes to null when adding an item', async () => {
    const productId = await seedProduct();
    const orderId = await createDraft(12);

    await addItem(orderId, productId, 1, '   ');

    const result = await database().query(
      'SELECT notes FROM order_items WHERE order_id = $1',
      [orderId],
    );
    expect(result.rows[0].notes).toBeNull();
  });

  it('updates quantity without changing notes and recalculates the total', async () => {
    const productId = await seedProduct();
    const orderId = await createDraft(13);
    const [itemId] = await addItem(orderId, productId, 1, 'No onions');

    const response = await api()
      .patch(`/orders/${orderId}/items/${itemId}`)
      .set('Authorization', staff())
      .send({ quantity: 3 })
      .expect(204);
    expect(response.text).toBe('');

    const result = await api()
      .get(`/orders/${orderId}`)
      .set('Authorization', staff())
      .expect(200);
    expect(result.body.data.items[0]).toMatchObject({
      quantity: 3,
      notes: 'No onions',
      subtotal: '149.70',
    });
    expect(result.body.data.total).toBe('149.70');
  });

  it('updates notes independently and clears whitespace notes', async () => {
    const productId = await seedProduct();
    const orderId = await createDraft(14);
    const [itemId] = await addItem(orderId, productId, 2);

    await api()
      .patch(`/orders/${orderId}/items/${itemId}`)
      .set('Authorization', staff())
      .send({ notes: '  Well done  ' })
      .expect(204);
    let result = await database().query(
      'SELECT quantity, notes FROM order_items WHERE id = $1',
      [itemId],
    );
    expect(result.rows[0]).toEqual({ quantity: 2, notes: 'Well done' });

    await api()
      .patch(`/orders/${orderId}/items/${itemId}`)
      .set('Authorization', staff())
      .send({ notes: '   ' })
      .expect(204);
    result = await database().query(
      'SELECT quantity, notes FROM order_items WHERE id = $1',
      [itemId],
    );
    expect(result.rows[0]).toEqual({ quantity: 2, notes: null });
  });

  it('removes one item and recalculates the total', async () => {
    const productId = await seedProduct();
    const orderId = await createDraft(15);
    const [removedId] = await addItem(orderId, productId, 1, 'First');
    await addItem(orderId, productId, 2, 'Second');

    const response = await api()
      .delete(`/orders/${orderId}/items/${removedId}`)
      .set('Authorization', staff())
      .expect(204);
    expect(response.text).toBe('');
    const result = await api()
      .get(`/orders/${orderId}`)
      .set('Authorization', staff())
      .expect(200);
    expect(result.body.data.items).toHaveLength(1);
    expect(result.body.data.items[0]).toMatchObject({ notes: 'Second', quantity: 2 });
    expect(result.body.data.total).toBe('99.80');
    expect(
      (await database().query('SELECT id FROM order_items WHERE id = $1', [removedId]))
        .rowCount,
    ).toBe(0);
  });
});
