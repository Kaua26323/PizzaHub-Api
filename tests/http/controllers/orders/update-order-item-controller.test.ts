import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { UpdateOrderItemController } from '@/presentation/http/controllers/orders/update-order-item-controller';
import type { UpdateOrderItemUseCase } from '@/application/use-cases/orders/update-order-item';
import {
  itemId,
  jsonOptions,
  orderControllerTestServer,
  orderId,
  staffActor,
} from './order-controller-test-server';

function makeServer() {
  const execute = vi.fn(async () => undefined);
  const controller = new UpdateOrderItemController(
    { execute } as unknown as UpdateOrderItemUseCase,
    jsonOptions,
  );

  return {
    execute,
    server: orderControllerTestServer(
      'patch',
      '/orders/:orderId/items/:itemId',
      controller.handler,
    ),
  };
}

describe('UpdateOrderItemController', () => {
  it('should pass partial item updates with normalized notes to the use case', async () => {
    const { execute, server } = makeServer();

    await request(server)
      .patch(`/orders/${orderId}/items/${itemId}`)
      .send({ notes: '  Extra cheese  ' })
      .expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: staffActor,
      orderId,
      itemId,
      changes: { notes: 'Extra cheese' },
    });
  });

  it('should reject an empty update before invoking the use case', async () => {
    const { execute, server } = makeServer();

    await request(server)
      .patch(`/orders/${orderId}/items/${itemId}`)
      .send({})
      .expect(400);

    expect(execute).not.toHaveBeenCalled();
  });
});
