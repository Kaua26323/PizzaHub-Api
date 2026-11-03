import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { ListOrdersController } from '@/presentation/http/controllers/orders/list-orders-controller';
import type { ListOrdersUseCase } from '@/application/use-cases/orders/list-orders';
import { orderControllerTestServer, staffActor } from './order-controller-test-server';

function makeServer() {
  const execute = vi.fn(async () => []);
  const controller = new ListOrdersController({
    execute,
  } as unknown as ListOrdersUseCase);

  return {
    execute,
    server: orderControllerTestServer('get', '/orders', controller.handler),
  };
}

describe('ListOrdersController', () => {
  it('should pass the preparation queue filter to the use case', async () => {
    const { execute, server } = makeServer();

    await request(server).get('/orders?status=IN_PREPARATION').expect(200);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: staffActor,
      filters: { status: 'IN_PREPARATION' },
    });
  });

  it('should reject repeated status filters before invoking the use case', async () => {
    const { execute, server } = makeServer();

    await request(server).get('/orders?status=DRAFT&status=IN_PREPARATION').expect(400);

    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects an unsupported status filter before invoking the use case', async () => {
    const { execute, server } = makeServer();

    const response = await request(server).get('/orders?status=UNKNOWN').expect(400);

    expect(response.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: expect.any(String) },
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
