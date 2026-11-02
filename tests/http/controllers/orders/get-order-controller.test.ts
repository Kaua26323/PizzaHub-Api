import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { Order } from '@/domain/entities/order';
import { GetOrderController } from '@/presentation/http/controllers/orders/get-order-controller';
import type { GetOrderUseCase } from '@/application/use-cases/orders/get-order';
import {
  itemId,
  orderControllerTestServer,
  orderId,
  productId,
  staffActor,
} from './order-controller-test-server';

function makeServer(order: Order) {
  const execute = vi.fn(async () => order);
  const controller = new GetOrderController({ execute } as unknown as GetOrderUseCase);

  return {
    execute,
    server: orderControllerTestServer('get', '/orders/:orderId', controller.handler),
  };
}

describe('GetOrderController', () => {
  it('should serialize order details with item prices, total, creator, and timestamps', async () => {
    const order = Order.create({
      id: orderId,
      tableNumber: 7,
      createdByUserId: staffActor.id,
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
    });
    order.addItem({
      id: itemId,
      productId,
      productName: 'Pizza',
      unitPrice: '45.90',
      quantity: 2,
      notes: 'No onions',
    });
    order.submit(new Date('2026-01-02T03:05:05.000Z'));
    const { execute, server } = makeServer(order);

    const response = await request(server).get(`/orders/${orderId}`).expect(200);

    expect(execute).toHaveBeenCalledExactlyOnceWith({ actor: staffActor, orderId });
    expect(response.body.data).toMatchObject({
      id: orderId,
      tableNumber: 7,
      status: 'IN_PREPARATION',
      total: '91.80',
      createdByUserId: staffActor.id,
      createdAt: '2026-01-02T03:04:05.000Z',
      submittedAt: '2026-01-02T03:05:05.000Z',
      completedAt: null,
      cancelledAt: null,
      items: [
        {
          id: itemId,
          productId,
          unitPrice: '45.90',
          quantity: 2,
          subtotal: '91.80',
          notes: 'No onions',
        },
      ],
    });
  });
});
