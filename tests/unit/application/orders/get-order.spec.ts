import { describe, expect, it } from 'vitest';

import { Order } from '@/domain/entities/order';
import type { OrderProps } from '@/domain/entities/order';

import { GetOrderUseCase } from '@/application/use-cases/orders/get-order';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import { InMemoryOrdersRepository } from '@tests/doubles/repositories/in-memory-orders-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const ordersRepository = new InMemoryOrdersRepository();

  const sut = new GetOrderUseCase(ordersRepository);

  return {
    sut,
    ordersRepository,
  };
}

function makeActor(overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    id: 'user-id',
    role: 'ADMIN',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderProps> = {}): Order {
  return Order.create({
    id: 'order-id',
    tableNumber: 1,
    customerName: null,
    createdByUserId: 'user-id',
    createdAt: currentDate,
    ...overrides,
  });
}

function addItemToOrder(
  order: Order,
  overrides: Partial<{
    id: string;
    productId: string;
    productName: string;
    unitPrice: string;
    quantity: number;
    notes: string | null;
  }> = {},
): void {
  order.addItem({
    id: 'item-id-1',
    productId: 'product-id',
    productName: 'Margherita',
    unitPrice: '55.80',
    quantity: 1,
    notes: 'Without onions',
    ...overrides,
  });
}

async function createOrderWithItem(
  ordersRepository: InMemoryOrdersRepository,
): Promise<void> {
  const order = makeOrder();

  addItemToOrder(order);

  await ordersRepository.create(order);
}
describe('GetOrderUseCase', () => {
  it.each(['ADMIN', 'STAFF'] as const)(
    'should allow %s to get complete order details',
    async (role) => {
      const { sut, ordersRepository } = makeSut();

      await createOrderWithItem(ordersRepository);

      const result = await sut.execute({
        actor: makeActor({ role }),
        orderId: 'order-id',
      });

      expect(result).toBeInstanceOf(Order);

      expect(result.id).toBe('order-id');
      expect(result.tableNumber).toBe(1);
      expect(result.customerName).toBeNull();
      expect(result.status).toBe('DRAFT');
      expect(result.createdByUserId).toBe('user-id');
      expect(result.createdAt).toStrictEqual(currentDate);

      expect(result.items).toHaveLength(1);

      const item = result.items[0];

      expect(item?.id).toBe('item-id-1');
      expect(item?.orderId).toBe('order-id');
      expect(item?.productId).toBe('product-id');
      expect(item?.productName).toBe('Margherita');
      expect(item?.unitPrice).toBe('55.80');
      expect(item?.quantity).toBe(1);
      expect(item?.notes).toBe('Without onions');
      expect(item?.subtotal).toBe('55.80');
    },
  );

  it('should reject when the order does not exist', async () => {
    const { sut } = makeSut();

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'missing-order-id',
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Order not found.');
  });
});
