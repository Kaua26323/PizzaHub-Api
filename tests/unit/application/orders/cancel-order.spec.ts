import { describe, expect, it, vi } from 'vitest';

import { Order } from '@/domain/entities/order';
import type { OrderProps } from '@/domain/entities/order';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { CancelOrderUseCase } from '@/application/use-cases/orders/cancel-order';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import { FakeClock } from '@tests/doubles/services/fake-clock';
import { InMemoryOrdersRepository } from '@tests/doubles/repositories/in-memory-orders-repository';

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const submittedAt = new Date('2026-01-01T01:00:00.000Z');
const previouslyCancelledAt = new Date('2026-01-01T01:15:00.000Z');
const cancelledAt = new Date('2026-01-01T01:30:00.000Z');
const completedAt = new Date('2026-01-01T02:00:00.000Z');

function makeSut() {
  const clock = new FakeClock(cancelledAt);
  const ordersRepository = new InMemoryOrdersRepository();

  const sut = new CancelOrderUseCase(clock, ordersRepository);

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

function makeCompletedOrder(overrides: Partial<OrderProps> = {}): Order {
  const order = makeOrderInPreparation(overrides);

  order.complete(completedAt);

  return order;
}

function makeCancelledOrder(overrides: Partial<OrderProps> = {}): Order {
  const order = makeOrder(overrides);

  order.cancel(previouslyCancelledAt);

  return order;
}

describe('CancelOrderUseCase', () => {
  it.each(['ADMIN', 'STAFF'] as const)(
    'should allow %s to cancel a draft order',
    async (role) => {
      const { sut, ordersRepository } = makeSut();

      const order = makeOrder();

      await ordersRepository.create(order);

      await sut.execute({
        actor: makeActor({ role }),
        orderId: 'order-id',
      });

      const persistedOrder = await ordersRepository.findById('order-id');

      expect(persistedOrder).not.toBeNull();
      expect(persistedOrder?.status).toBe('CANCELLED');
      expect(persistedOrder?.cancelledAt).toStrictEqual(cancelledAt);
      expect(persistedOrder?.submittedAt).toBeNull();
      expect(persistedOrder?.completedAt).toBeNull();
    },
  );

  it.each(['ADMIN', 'STAFF'] as const)(
    'should allow %s to cancel an order in preparation',
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
      expect(persistedOrder?.status).toBe('CANCELLED');
      expect(persistedOrder?.cancelledAt).toStrictEqual(cancelledAt);
      expect(persistedOrder?.submittedAt).toStrictEqual(submittedAt);
      expect(persistedOrder?.completedAt).toBeNull();
      expect(persistedOrder?.items).toHaveLength(1);
    },
  );

  it('should reject cancelling a completed order', async () => {
    const { sut, ordersRepository } = makeSut();

    const order = makeCompletedOrder();

    await ordersRepository.create(order);

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
    });

    await expect(execution).rejects.toThrow(ConflictError);
    await expect(execution).rejects.toThrow(
      'Only draft or in-preparation orders can be cancelled.',
    );

    const persistedOrder = await ordersRepository.findById('order-id');

    expect(persistedOrder?.status).toBe('COMPLETED');
    expect(persistedOrder?.completedAt).toStrictEqual(completedAt);
    expect(persistedOrder?.cancelledAt).toBeNull();
  });

  it('should reject cancelling an already cancelled order', async () => {
    const { sut, ordersRepository } = makeSut();

    const order = makeCancelledOrder();

    await ordersRepository.create(order);

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
    });

    await expect(execution).rejects.toThrow(ConflictError);
    await expect(execution).rejects.toThrow(
      'Only draft or in-preparation orders can be cancelled.',
    );

    const persistedOrder = await ordersRepository.findById('order-id');

    expect(persistedOrder?.status).toBe('CANCELLED');
    expect(persistedOrder?.cancelledAt).toStrictEqual(previouslyCancelledAt);
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

  it('should reject cancellation when the order is completed during the protected save', async () => {
    const { sut, ordersRepository } = makeSut();

    const order = makeOrderInPreparation();

    await ordersRepository.create(order);

    const originalSave = ordersRepository.save.bind(ordersRepository);

    vi.spyOn(ordersRepository, 'save').mockImplementationOnce(async (orderId, change) => {
      // Simulates another request winning
      // the race and completing the order first.
      await originalSave(orderId, (currentOrder) => {
        currentOrder.complete(completedAt);
      });

      // The cancellation now operates on
      // the already updated state.
      return originalSave(orderId, change);
    });

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
    });

    await expect(execution).rejects.toThrow(ConflictError);

    await expect(execution).rejects.toThrow(
      'Only draft or in-preparation orders can be cancelled.',
    );

    const persistedOrder = await ordersRepository.findById('order-id');

    expect(persistedOrder?.status).toBe('COMPLETED');

    expect(persistedOrder?.completedAt).toStrictEqual(completedAt);

    expect(persistedOrder?.cancelledAt).toBeNull();
  });
});
