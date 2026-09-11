import { describe, expect, it, vi } from 'vitest';

import { Order } from '@/domain/entities/order';
import type { OrderProps } from '@/domain/entities/order';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { CompleteOrderUseCase } from '@/application/use-cases/orders/complete-order';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import { FakeClock } from '@tests/doubles/services/fake-clock';
import { InMemoryOrdersRepository } from '@tests/doubles/repositories/in-memory-orders-repository';

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const submittedAt = new Date('2026-01-01T01:00:00.000Z');
const cancelledAt = new Date('2026-01-01T01:30:00.000Z');
const completedAt = new Date('2026-01-01T02:00:00.000Z');

function makeSut() {
  const clock = new FakeClock(completedAt);
  const ordersRepository = new InMemoryOrdersRepository();

  const sut = new CompleteOrderUseCase(clock, ordersRepository);

  return {
    sut,
    clock,
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
    createdAt,
    ...overrides,
  });
}

function addItemToOrder(order: Order, itemId = 'item-id'): void {
  order.addItem({
    id: itemId,
    productId: 'product-id',
    productName: 'Margherita',
    unitPrice: '55.80',
    quantity: 1,
    notes: 'Without onions',
  });
}

function makeOrderInPreparation(overrides: Partial<OrderProps> = {}): Order {
  const order = makeOrder(overrides);

  addItemToOrder(order, `item-${order.id}`);

  order.submit(submittedAt);

  return order;
}

describe('CompleteOrderUseCase', () => {
  it.each(['ADMIN', 'STAFF'] as const)(
    'should allow %s to complete an order in preparation',
    async (role) => {
      const { sut, ordersRepository } = makeSut();

      const order = makeOrderInPreparation();

      await ordersRepository.create(order);

      await sut.execute({
        actor: makeActor({ role }),
        orderId: 'order-id',
      });

      const persistedOrder = await ordersRepository.findById('order-id');

      expect(persistedOrder).not.toBeNull();
      expect(persistedOrder?.status).toBe('COMPLETED');
      expect(persistedOrder?.submittedAt).toStrictEqual(submittedAt);
      expect(persistedOrder?.completedAt).toStrictEqual(completedAt);
      expect(persistedOrder?.cancelledAt).toBeNull();
      expect(persistedOrder?.items).toHaveLength(1);
    },
  );

  it('should reject completing an order that is not in preparation', async () => {
    const { sut, ordersRepository } = makeSut();

    const order = makeOrder();

    addItemToOrder(order);

    await ordersRepository.create(order);

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
    });

    await expect(execution).rejects.toThrow(ConflictError);

    await expect(execution).rejects.toThrow(
      'Only orders in preparation can be completed.',
    );

    const persistedOrder = await ordersRepository.findById('order-id');

    expect(persistedOrder?.status).toBe('DRAFT');
    expect(persistedOrder?.completedAt).toBeNull();
  });

  it('should reject when the order does not exist', async () => {
    const { sut } = makeSut();

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'missing-order-id',
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Order not found.');
  });

  it('should reject completion when the order is cancelled during the protected save', async () => {
    const { sut, ordersRepository } = makeSut();

    const order = makeOrderInPreparation();

    await ordersRepository.create(order);

    vi.spyOn(ordersRepository, 'save').mockImplementationOnce(
      async (_orderId, change) => {
        const currentOrder = await ordersRepository.findById('order-id');

        if (!currentOrder) {
          return {
            status: 'not-found',
          };
        }

        currentOrder.cancel(cancelledAt);
        await ordersRepository.cancel(currentOrder);

        change(currentOrder);

        console.log(currentOrder);
        return {
          status: 'saved',
        };
      },
    );

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
    });

    await expect(execution).rejects.toThrow(ConflictError);
    await expect(execution).rejects.toThrow(
      'Only orders in preparation can be completed.',
    );

    const persistedOrder = await ordersRepository.findById('order-id');

    expect(persistedOrder?.status).toBe('CANCELLED');
    expect(persistedOrder?.cancelledAt).toStrictEqual(cancelledAt);
    expect(persistedOrder?.completedAt).toBeNull();
  });
});
