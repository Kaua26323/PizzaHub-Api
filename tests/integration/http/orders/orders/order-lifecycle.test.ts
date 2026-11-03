import { beforeEach, describe, expect, it } from 'vitest';

import {
  addItem,
  api,
  createDraft,
  database,
  expectError,
  seedActor,
  seedProduct,
  staff,
} from '../helpers/order-api';

beforeEach(seedActor);

async function submit(orderId: string) {
  const response = await api()
    .patch(`/orders/${orderId}/submit`)
    .set('Authorization', staff())
    .expect(204);
  expect(response.text).toBe('');
}

async function complete(orderId: string) {
  const response = await api()
    .patch(`/orders/${orderId}/complete`)
    .set('Authorization', staff())
    .expect(204);
  expect(response.text).toBe('');
}

async function cancel(orderId: string) {
  const response = await api()
    .patch(`/orders/${orderId}/cancel`)
    .set('Authorization', staff())
    .expect(204);
  expect(response.text).toBe('');
}

describe('order lifecycle over HTTP', () => {
  it('submits a nonempty DRAFT order and exposes its timestamp', async () => {
    const productId = await seedProduct();
    const orderId = await createDraft(40);
    await addItem(orderId, productId);

    await submit(orderId);

    const persisted = await database().query(
      'SELECT status, submitted_at, completed_at, cancelled_at FROM orders WHERE id = $1',
      [orderId],
    );
    expect(persisted.rows[0]).toMatchObject({
      status: 'IN_PREPARATION',
      submitted_at: expect.any(Date),
      completed_at: null,
      cancelled_at: null,
    });
    const response = await api()
      .get(`/orders/${orderId}`)
      .set('Authorization', staff())
      .expect(200);
    expect(response.body.data.submittedAt).toBe(
      persisted.rows[0].submitted_at.toISOString(),
    );
  });

  it('completes an order in preparation and preserves its submission timestamp', async () => {
    const productId = await seedProduct();
    const orderId = await createDraft(41);
    await addItem(orderId, productId);
    await submit(orderId);

    await complete(orderId);

    const persisted = await database().query(
      'SELECT status, submitted_at, completed_at, cancelled_at FROM orders WHERE id = $1',
      [orderId],
    );
    expect(persisted.rows[0]).toMatchObject({
      status: 'COMPLETED',
      submitted_at: expect.any(Date),
      completed_at: expect.any(Date),
      cancelled_at: null,
    });
    const response = await api()
      .get(`/orders/${orderId}`)
      .set('Authorization', staff())
      .expect(200);
    expect(response.body.data.completedAt).toBe(
      persisted.rows[0].completed_at.toISOString(),
    );
    expect(response.body.data.submittedAt).toBe(
      persisted.rows[0].submitted_at.toISOString(),
    );
  });

  it.each(['DRAFT', 'IN_PREPARATION'] as const)(
    'cancels an order from %s and records the correct timestamps',
    async (initialStatus) => {
      const orderId = await createDraft(initialStatus === 'DRAFT' ? 42 : 43);
      if (initialStatus === 'IN_PREPARATION') {
        const productId = await seedProduct();
        await addItem(orderId, productId);
        await submit(orderId);
      }

      await cancel(orderId);

      const persisted = await database().query(
        'SELECT status, submitted_at, completed_at, cancelled_at FROM orders WHERE id = $1',
        [orderId],
      );
      expect(persisted.rows[0]).toMatchObject({
        status: 'CANCELLED',
        submitted_at: initialStatus === 'DRAFT' ? null : expect.any(Date),
        completed_at: null,
        cancelled_at: expect.any(Date),
      });
      const response = await api()
        .get(`/orders/${orderId}`)
        .set('Authorization', staff())
        .expect(200);
      expect(response.body.data.cancelledAt).toBe(
        persisted.rows[0].cancelled_at.toISOString(),
      );
    },
  );

  it('rejects submission of an empty order without changing its state', async () => {
    const orderId = await createDraft(44);

    const response = await api()
      .patch(`/orders/${orderId}/submit`)
      .set('Authorization', staff())
      .expect(409);

    expectError(response, 'ORDER_STATE_CONFLICT');
    const persisted = await database().query(
      'SELECT status, submitted_at FROM orders WHERE id = $1',
      [orderId],
    );
    expect(persisted.rows[0]).toEqual({ status: 'DRAFT', submitted_at: null });
  });

  it('rejects completion before submission', async () => {
    const orderId = await createDraft(45);

    const response = await api()
      .patch(`/orders/${orderId}/complete`)
      .set('Authorization', staff())
      .expect(409);

    expectError(response, 'ORDER_STATE_CONFLICT');
    const persisted = await database().query(
      'SELECT status, completed_at FROM orders WHERE id = $1',
      [orderId],
    );
    expect(persisted.rows[0]).toEqual({ status: 'DRAFT', completed_at: null });
  });

  it.each(['COMPLETED', 'CANCELLED'] as const)(
    'rejects terminal transitions from %s',
    async (terminalStatus) => {
      const productId = await seedProduct();
      const orderId = await createDraft(terminalStatus === 'COMPLETED' ? 46 : 47);
      await addItem(orderId, productId);
      await submit(orderId);
      if (terminalStatus === 'COMPLETED') await complete(orderId);
      else await cancel(orderId);

      for (const action of ['submit', 'complete', 'cancel']) {
        const response = await api()
          .patch(`/orders/${orderId}/${action}`)
          .set('Authorization', staff())
          .expect(409);
        expectError(response, 'ORDER_STATE_CONFLICT');
      }

      const persisted = await database().query(
        'SELECT status FROM orders WHERE id = $1',
        [orderId],
      );
      expect(persisted.rows[0].status).toBe(terminalStatus);
    },
  );

  it.each(['IN_PREPARATION', 'COMPLETED', 'CANCELLED'] as const)(
    'rejects item addition, update, and removal after %s',
    async (terminalStatus) => {
      const productId = await seedProduct();
      const orderId = await createDraft(
        terminalStatus === 'IN_PREPARATION'
          ? 48
          : terminalStatus === 'COMPLETED'
            ? 49
            : 50,
      );
      const [itemId] = await addItem(orderId, productId, 2, 'Original');
      await submit(orderId);
      if (terminalStatus === 'COMPLETED') await complete(orderId);
      if (terminalStatus === 'CANCELLED') await cancel(orderId);

      const addResponse = await api()
        .post(`/orders/${orderId}/items`)
        .set('Authorization', staff())
        .send({ productId, quantity: 1 })
        .expect(409);
      const updateResponse = await api()
        .patch(`/orders/${orderId}/items/${itemId}`)
        .set('Authorization', staff())
        .send({ quantity: 3 })
        .expect(409);
      const removeResponse = await api()
        .delete(`/orders/${orderId}/items/${itemId}`)
        .set('Authorization', staff())
        .expect(409);
      for (const response of [addResponse, updateResponse, removeResponse]) {
        expectError(response, 'ORDER_STATE_CONFLICT');
      }

      const persisted = await database().query(
        'SELECT quantity, notes FROM order_items WHERE order_id = $1',
        [orderId],
      );
      expect(persisted.rows).toEqual([{ quantity: 2, notes: 'Original' }]);
    },
  );
});
