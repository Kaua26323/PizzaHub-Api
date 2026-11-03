import { beforeEach, describe, expect, it } from 'vitest';

import {
  absentId,
  addItem,
  api,
  createDraft,
  creatorId,
  expectError,
  seedActor,
  seedProduct,
  staff,
} from '../helpers/order-api';

beforeEach(seedActor);

describe('GET /orders/:orderId', () => {
  it('returns an empty DRAFT order in the public response envelope', async () => {
    const orderId = await createDraft(20);

    const response = await api()
      .get(`/orders/${orderId}`)
      .set('Authorization', staff())
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      error: null,
      data: {
        id: orderId,
        tableNumber: 20,
        customerName: null,
        status: 'DRAFT',
        items: [],
        total: '0.00',
        createdByUserId: creatorId(),
        createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT.*Z$/),
        submittedAt: null,
        completedAt: null,
        cancelledAt: null,
      },
    });
  });

  it('retrieves persisted items with snapshots, subtotals, and total', async () => {
    const productId = await seedProduct();
    const orderId = await createDraft(21, { customerName: 'Ava' });
    await addItem(orderId, productId, 2, 'No onions');

    const response = await api()
      .get(`/orders/${orderId}`)
      .set('Authorization', staff())
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: orderId,
      customerName: 'Ava',
      total: '99.80',
      items: [
        expect.objectContaining({
          orderId,
          productId,
          productName: 'Calabresa',
          unitPrice: '49.90',
          quantity: 2,
          subtotal: '99.80',
          notes: 'No onions',
        }),
      ],
    });
  });

  it('returns the standard not-found envelope for an unknown order', async () => {
    const response = await api()
      .get(`/orders/${absentId}`)
      .set('Authorization', staff())
      .expect(404);
    expectError(response, 'ORDER_NOT_FOUND');
  });
});
