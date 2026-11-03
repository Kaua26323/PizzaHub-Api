import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { AddOrderItemController } from '@/presentation/http/controllers/orders/add-order-item-controller';
import type { AddOrderItemUseCase } from '@/application/use-cases/orders/add-order-item';
import {
  jsonOptions,
  orderControllerTestServer,
  orderId,
  productId,
  staffActor,
} from './order-controller-test-server';

function makeServer() {
  const execute = vi.fn(async () => undefined);
  const controller = new AddOrderItemController(
    { execute } as unknown as AddOrderItemUseCase,
    jsonOptions,
  );

  return {
    execute,
    server: orderControllerTestServer(
      'post',
      '/orders/:orderId/items',
      controller.handler,
    ),
  };
}

describe('AddOrderItemController', () => {
  it('should pass a new distinct item with normalized notes and return HTTP 201', async () => {
    const { execute, server } = makeServer();

    const response = await request(server)
      .post(`/orders/${orderId}/items`)
      .send({ productId, quantity: 2, notes: '  ' })
      .expect(201);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: staffActor,
      orderId,
      productId,
      item: { quantity: 2, notes: null },
    });
    expect(response.body).toEqual({ success: true, data: null, error: null });
  });

  it.each([
    ['nonpositive quantity', { productId, quantity: 0 }],
    ['overlong notes', { productId, quantity: 1, notes: 'N'.repeat(501) }],
  ])('rejects %s before calling the use case', async (_description, body) => {
    const { execute, server } = makeServer();

    const response = await request(server)
      .post(`/orders/${orderId}/items`)
      .send(body)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: expect.any(String) },
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
