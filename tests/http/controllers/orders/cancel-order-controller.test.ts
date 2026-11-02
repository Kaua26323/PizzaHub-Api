import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { CancelOrderController } from '@/presentation/http/controllers/orders/cancel-order-controller';
import type { CancelOrderUseCase } from '@/application/use-cases/orders/cancel-order';
import {
  orderControllerTestServer,
  orderId,
  staffActor,
} from './order-controller-test-server';

function makeServer() {
  const execute = vi.fn(async () => undefined);
  const controller = new CancelOrderController({
    execute,
  } as unknown as CancelOrderUseCase);

  return {
    execute,
    server: orderControllerTestServer(
      'patch',
      '/orders/:orderId/cancel',
      controller.handler,
    ),
  };
}

describe('CancelOrderController', () => {
  it('should pass the actor and order ID to the use case and return HTTP 204', async () => {
    const { execute, server } = makeServer();

    await request(server).patch(`/orders/${orderId}/cancel`).expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({ actor: staffActor, orderId });
  });
});
