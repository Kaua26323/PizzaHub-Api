import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { CompleteOrderController } from '@/presentation/http/controllers/orders/complete-order-controller';
import type { CompleteOrderUseCase } from '@/application/use-cases/orders/complete-order';
import {
  orderControllerTestServer,
  orderId,
  staffActor,
} from './order-controller-test-server';

function makeServer() {
  const execute = vi.fn(async () => undefined);
  const controller = new CompleteOrderController({
    execute,
  } as unknown as CompleteOrderUseCase);

  return {
    execute,
    server: orderControllerTestServer(
      'patch',
      '/orders/:orderId/complete',
      controller.handler,
    ),
  };
}

describe('CompleteOrderController', () => {
  it('should pass the actor and order ID to the use case and return HTTP 204', async () => {
    const { execute, server } = makeServer();

    await request(server).patch(`/orders/${orderId}/complete`).expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({ actor: staffActor, orderId });
  });
});
