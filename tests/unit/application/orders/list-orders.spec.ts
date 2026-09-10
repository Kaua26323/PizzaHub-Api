import { describe, expect, it } from 'vitest';

import { Order } from '@/domain/entities/order';
import type { OrderProps } from '@/domain/entities/order';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { ListOrdersUseCase } from '@/application/use-cases/orders/list-orders';

import { InMemoryOrdersRepository } from '@tests/doubles/repositories/in-memory-orders-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

const submittedAt = new Date('2026-01-01T01:00:00.000Z');

const completedAt = new Date('2026-01-01T02:00:00.000Z');

function makeSut() {
  const ordersRepository = new InMemoryOrdersRepository();

  const sut = new ListOrdersUseCase(ordersRepository);

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

function addItemToOrder(order: Order, itemId = 'item-id'): void {
  order.addItem({
    id: itemId,
    productId: 'product-id',
    productName: 'Margherita',
    unitPrice: '55.80',
    quantity: 1,
    notes: null,
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

describe('ListOrdersUseCase', () => {
  it.each(['ADMIN', 'STAFF'] as const)('should allow %s to list orders', async (role) => {
    const { sut, ordersRepository } = makeSut();

    await ordersRepository.create(makeOrder());

    const result = await sut.execute({
      actor: makeActor({ role }),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Order);
    expect(result[0]?.id).toBe('order-id');
  });

  it('should list all orders when no status filter is provided', async () => {
    const { sut, ordersRepository } = makeSut();

    const draftOrder = makeOrder({
      id: 'draft-order-id',
      tableNumber: 1,
    });

    const preparationOrder = makeOrderInPreparation({
      id: 'preparation-order-id',
      tableNumber: 2,
    });

    const completedOrder = makeCompletedOrder({
      id: 'completed-order-id',
      tableNumber: 3,
    });

    await ordersRepository.create(draftOrder);
    await ordersRepository.create(preparationOrder);
    await ordersRepository.create(completedOrder);

    const result = await sut.execute({
      actor: makeActor(),
    });

    expect(result).toHaveLength(3);

    expect(result.map((order) => order.id)).toEqual(
      expect.arrayContaining([
        'draft-order-id',
        'preparation-order-id',
        'completed-order-id',
      ]),
    );
  });

  it('should filter orders by status', async () => {
    const { sut, ordersRepository } = makeSut();

    await ordersRepository.create(
      makeOrder({
        id: 'draft-order-id',
        tableNumber: 1,
      }),
    );

    await ordersRepository.create(
      makeOrderInPreparation({
        id: 'preparation-order-id',
        tableNumber: 2,
      }),
    );

    await ordersRepository.create(
      makeCompletedOrder({
        id: 'completed-order-id',
        tableNumber: 3,
      }),
    );

    const result = await sut.execute({
      actor: makeActor(),
      filters: {
        status: 'COMPLETED',
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('completed-order-id');
    expect(result[0]?.status).toBe('COMPLETED');
  });

  it('should return only IN_PREPARATION orders for the preparation queue', async () => {
    const { sut, ordersRepository } = makeSut();

    await ordersRepository.create(
      makeOrder({
        id: 'draft-order-id',
        tableNumber: 1,
      }),
    );

    await ordersRepository.create(
      makeOrderInPreparation({
        id: 'preparation-order-1',
        tableNumber: 2,
      }),
    );

    await ordersRepository.create(
      makeOrderInPreparation({
        id: 'preparation-order-2',
        tableNumber: 3,
      }),
    );

    await ordersRepository.create(
      makeCompletedOrder({
        id: 'completed-order-id',
        tableNumber: 4,
      }),
    );

    const result = await sut.execute({
      actor: makeActor({
        role: 'STAFF',
      }),
      filters: {
        status: 'IN_PREPARATION',
      },
    });

    expect(result).toHaveLength(2);
    expect(result.every((order) => order.status === 'IN_PREPARATION')).toBe(true);

    expect(result.map((order) => order.id)).toEqual(
      expect.arrayContaining(['preparation-order-1', 'preparation-order-2']),
    );
  });

  it('should return an empty list when no orders exist', async () => {
    const { sut } = makeSut();

    const result = await sut.execute({
      actor: makeActor(),
    });

    expect(result).toEqual([]);
  });

  it('should return an empty list when no orders match the selected status', async () => {
    const { sut, ordersRepository } = makeSut();

    await ordersRepository.create(
      makeOrder({
        id: 'draft-order-id',
      }),
    );

    const result = await sut.execute({
      actor: makeActor(),
      filters: {
        status: 'IN_PREPARATION',
      },
    });

    expect(result).toEqual([]);
  });
});
