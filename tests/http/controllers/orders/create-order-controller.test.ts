import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { CreateOrderController } from '@/presentation/http/controllers/orders/create-order-controller';
import type { CreateOrderUseCase } from '@/application/use-cases/orders/create-order';
import {
  jsonOptions,
  orderControllerTestServer,
  staffActor,
} from './order-controller-test-server';

function makeServer() {
  const execute = vi.fn(async () => undefined);
  const controller = new CreateOrderController(
    { execute } as unknown as CreateOrderUseCase,
    jsonOptions,
  );

  return {
    execute,
    server: orderControllerTestServer('post', '/orders', controller.handler),
  };
}

describe('CreateOrderController', () => {
  it('should pass normalized creation input to the use case and return HTTP 201', async () => {
    const { execute, server } = makeServer();

    const response = await request(server)
      .post('/orders')
      .send({ tableNumber: 7, customerName: '  Ava  ' })
      .expect(201);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: staffActor,
      tableNumber: 7,
      customerName: 'Ava',
    });
    expect(response.body).toEqual({ success: true, data: null, error: null });
  });

  it('rejects a missing table number before calling the use case', async () => {
    const { execute, server } = makeServer();

    const response = await request(server)
      .post('/orders')
      .send({ customerName: 'Ava' })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: expect.any(String) },
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
