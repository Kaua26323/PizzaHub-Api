import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { RemoveOrderItemController } from '@/presentation/http/controllers/orders/remove-order-item-controller';
import type { RemoveOrderItemUseCase } from '@/application/use-cases/orders/remove-order-item';
import {
  itemId,
  orderControllerTestServer,
  orderId,
  staffActor,
} from './order-controller-test-server';

function makeServer() {
  const execute = vi.fn(async () => undefined);
  const controller = new RemoveOrderItemController({
    execute,
  } as unknown as RemoveOrderItemUseCase);

  return {
    execute,
    server: orderControllerTestServer(
      'delete',
      '/orders/:orderId/items/:itemId',
      controller.handler,
    ),
  };
}

describe('RemoveOrderItemController', () => {
  it('should pass the actor and item IDs to the use case and return HTTP 204', async () => {
    const { execute, server } = makeServer();

    await request(server).delete(`/orders/${orderId}/items/${itemId}`).expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: staffActor,
      orderId,
      itemId,
    });
  });
});
