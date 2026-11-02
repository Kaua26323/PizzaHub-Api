import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { SubmitOrderController } from '@/presentation/http/controllers/orders/submit-order-controller';
import type { SubmitOrderUseCase } from '@/application/use-cases/orders/submit-order';
import {
  orderControllerTestServer,
  orderId,
  staffActor,
} from './order-controller-test-server';

function makeServer() {
  const execute = vi.fn(async () => undefined);
  const controller = new SubmitOrderController({
    execute,
  } as unknown as SubmitOrderUseCase);

  return {
    execute,
    server: orderControllerTestServer(
      'patch',
      '/orders/:orderId/submit',
      controller.handler,
    ),
  };
}

describe('SubmitOrderController', () => {
  it('should pass the actor and order ID to the use case and return HTTP 204', async () => {
    const { execute, server } = makeServer();

    await request(server).patch(`/orders/${orderId}/submit`).expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({ actor: staffActor, orderId });
  });
});
