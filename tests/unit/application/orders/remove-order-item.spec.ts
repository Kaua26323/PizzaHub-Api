import { describe, expect, it, vi } from 'vitest';

import { Order } from '@/domain/entities/order';
import type { OrderProps } from '@/domain/entities/order';

import type { AuthenticatedActor } from '@/application/authenticated-actor';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import { InMemoryOrdersRepository } from '@tests/doubles/repositories/in-memory-orders-repository';
import { RemoveOrderItemUseCase } from '@/application/use-cases/orders/remove-order-item';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const ordersRepository = new InMemoryOrdersRepository();

  const sut = new RemoveOrderItemUseCase(ordersRepository);

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
describe('RemoveOrderItemUseCase', () => {
  it.each(['ADMIN', 'STAFF'] as const)(
    'should allow %s actor to remove an item from a draft order',
    async (role) => {
      const { sut, ordersRepository } = makeSut();

      await createOrderWithItem(ordersRepository);

      await sut.execute({
        actor: makeActor({ role }),
        orderId: 'order-id',
        itemId: 'item-id-1',
      });

      const order = await ordersRepository.findById('order-id');

      expect(order?.items).toHaveLength(0);
    },
  );

  it('should reject removing an item from a non-draft order', async () => {
    const { sut, ordersRepository } = makeSut();

    const order = makeOrder();

    addItemToOrder(order);

    order.submit(currentDate);

    await ordersRepository.create(order);

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      itemId: 'item-id-1',
    });

    await expect(execution).rejects.toThrow(ConflictError);
    await expect(execution).rejects.toThrow('Only draft orders can remove items.');

    const persistedOrder = await ordersRepository.findById('order-id');

    expect(persistedOrder?.items).toHaveLength(1);
  });

  it('should reject when the order is no longer DRAFT during th e protected save', async () => {
    const { sut, ordersRepository } = makeSut();

    await createOrderWithItem(ordersRepository);
    expect(ordersRepository.orders[0]?.items).toHaveLength(1);

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
      itemId: 'item-id-1',
    });

    await expect(execution).rejects.toThrow(ConflictError);
    await expect(execution).rejects.toThrow('Only draft orders can remove items.');
  });

  it('should reject removing an item that belongs to another order', async () => {
    const { sut, ordersRepository } = makeSut();

    const targetOrder = makeOrder();

    await ordersRepository.create(targetOrder);

    const otherOrder = makeOrder({
      id: 'other-order-id',
    });

    addItemToOrder(otherOrder, {
      id: 'other-item-id',
    });

    await ordersRepository.create(otherOrder);

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      itemId: 'other-item-id',
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Order item not found.');

    const persistedTargetOrder = await ordersRepository.findById('order-id');
    const persistedOtherOrder = await ordersRepository.findById('other-order-id');

    expect(persistedTargetOrder?.items).toHaveLength(0);
    expect(persistedOtherOrder?.items).toHaveLength(1);
    expect(persistedOtherOrder?.items[0]?.id).toBe('other-item-id');
  });

  it('should reject when the item does not exist', async () => {
    const { sut, ordersRepository } = makeSut();

    await createOrderWithItem(ordersRepository);

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      itemId: 'missing-item-id',
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Order item not found.');
  });
  it('should reject when the order does not exist', async () => {
    const { sut } = makeSut();

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'missing-order-id',
      itemId: 'item-id-1',
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Order not found.');
  });
});
