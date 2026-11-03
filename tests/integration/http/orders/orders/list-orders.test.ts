import { beforeEach, describe, expect, it } from 'vitest';

import {
  addItem,
  api,
  createDraft,
  seedActor,
  seedProduct,
  staff,
} from '../helpers/order-api';

beforeEach(seedActor);

describe('GET /orders', () => {
  it('lists persisted orders with their items', async () => {
    const productId = await seedProduct();
    const firstId = await createDraft(30);
    await addItem(firstId, productId);
    const secondId = await createDraft(31);

    const response = await api().get('/orders').set('Authorization', staff()).expect(200);

    expect(response.body).toMatchObject({ success: true, error: null });
    expect(response.body.data.map((order: { id: string }) => order.id)).toEqual(
      expect.arrayContaining([firstId, secondId]),
    );
    expect(response.body.data).toHaveLength(2);
    const first = response.body.data.find(
      (order: { id: string }) => order.id === firstId,
    );
    const second = response.body.data.find(
      (order: { id: string }) => order.id === secondId,
    );
    expect(first).toMatchObject({
      total: '49.90',
      items: [expect.objectContaining({ productId })],
    });
    expect(second).toMatchObject({ total: '0.00', items: [] });
  });

  it('filters persisted orders by status for the preparation queue', async () => {
    const productId = await seedProduct();
    const draftId = await createDraft(32);
    const preparingId = await createDraft(33);
    await addItem(preparingId, productId);
    await api()
      .patch(`/orders/${preparingId}/submit`)
      .set('Authorization', staff())
      .expect(204);

    const response = await api()
      .get('/orders?status=IN_PREPARATION')
      .set('Authorization', staff())
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: preparingId,
      status: 'IN_PREPARATION',
      total: '49.90',
    });
    expect(response.body.data.map((order: { id: string }) => order.id)).not.toContain(
      draftId,
    );
  });
});
