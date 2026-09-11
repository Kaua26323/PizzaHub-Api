import { describe, expect, it, vi } from 'vitest';

import { Order } from '@/domain/entities/order';
import type { OrderProps } from '@/domain/entities/order';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { SubmitOrderUseCase } from '@/application/use-cases/orders/submit-order';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import { FakeClock } from '@tests/doubles/services/fake-clock';
import { InMemoryOrdersRepository } from '@tests/doubles/repositories/in-memory-orders-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const clock = new FakeClock(currentDate);
  const ordersRepository = new InMemoryOrdersRepository();

  const sut = new SubmitOrderUseCase(clock, ordersRepository);

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
    createdAt: currentDate,
    ...overrides,
  });
}

function addItemToOrder(order: Order): void {
  order.addItem({
    id: 'item-id',
    productId: 'product-id',
    productName: 'Margherita',
    unitPrice: '55.80',
    quantity: 1,
    notes: 'Without onions',
  });
}

async function createOrderWithItem(
  ordersRepository: InMemoryOrdersRepository,
): Promise<void> {
  const order = makeOrder();

  addItemToOrder(order);

  await ordersRepository.create(order);
}

describe('SubmitOrderUseCase', () => {
  it.each(['ADMIN', 'STAFF'] as const)(
    'should allow %s to submit a draft order',
    async (role) => {
      const { sut, ordersRepository } = makeSut();

      await createOrderWithItem(ordersRepository);

      await sut.execute({
        actor: makeActor({ role }),
        orderId: 'order-id',
      });

      const order = await ordersRepository.findById('order-id');

      expect(order).not.toBeNull();
      expect(order?.items).toHaveLength(1);
      expect(order?.status).toBe('IN_PREPARATION');
      expect(order?.submittedAt).toStrictEqual(currentDate);
    },
  );

  it('should reject submitting an empty order', async () => {
    const { sut, ordersRepository } = makeSut();

    await ordersRepository.create(makeOrder());

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
    });

    await expect(execution).rejects.toThrow(ConflictError);
    await expect(execution).rejects.toThrow('An empty order cannot be submitted.');

    const order = await ordersRepository.findById('order-id');

    expect(order?.status).toBe('DRAFT');
    expect(order?.submittedAt).toBeNull();
  });

  it('should reject submitting a non-draft order', async () => {
    const { sut, ordersRepository } = makeSut();

    const order = makeOrder();

    addItemToOrder(order);

    order.submit(currentDate);

    await ordersRepository.create(order);

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
    });

    await expect(execution).rejects.toThrow(ConflictError);
    await expect(execution).rejects.toThrow('Only draft orders can be submitted.');

    const persistedOrder = await ordersRepository.findById('order-id');

    expect(persistedOrder?.status).toBe('IN_PREPARATION');
    expect(persistedOrder?.submittedAt).toStrictEqual(currentDate);
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

  it('should reject when the order is no longer DRAFT during the protected save', async () => {
    const { sut, ordersRepository } = makeSut();

    await createOrderWithItem(ordersRepository);

    vi.spyOn(ordersRepository, 'save').mockImplementationOnce(
      async (_orderId, change) => {
        const currentOrder = await ordersRepository.findById('order-id');

        if (!currentOrder) {
          return {
            status: 'not-found',
          };
        }

        currentOrder.submit(currentDate);

        change(currentOrder);

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
    await expect(execution).rejects.toThrow('Only draft orders can be submitted.');
  });
});
