import { describe, expect, it, vi } from 'vitest';

import { Order } from '@/domain/entities/order';
import type { OrderProps } from '@/domain/entities/order';

import { InvalidQuantityError } from '@/domain/errors/invalid-quantity-error';
import { InvalidOrderItemError } from '@/domain/errors/invalid-order-item-error';

import type { AuthenticatedActor } from '@/application/authenticated-actor';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import { UpdateOrderItemUseCase } from '@/application/use-cases/orders/update-order-item';

import { InMemoryOrdersRepository } from '@tests/doubles/repositories/in-memory-orders-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const ordersRepository = new InMemoryOrdersRepository();

  const sut = new UpdateOrderItemUseCase(ordersRepository);

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

describe('UpdateOrderItemUseCase', () => {
  it.each(['ADMIN', 'STAFF'] as const)(
    'should allow an %s actor to update quantity and notes of a draft order item',
    async (role) => {
      const { sut, ordersRepository } = makeSut();

      await createOrderWithItem(ordersRepository);

      await sut.execute({
        actor: makeActor({ role }),
        orderId: 'order-id',
        itemId: 'item-id-1',
        changes: {
          notes: 'Without onions and tomato.',
          quantity: 5,
        },
      });

      const order = await ordersRepository.findById('order-id');

      expect(order).not.toBeNull();
      expect(order?.items).toHaveLength(1);

      const item = order?.items[0];

      expect(item?.id).toBe('item-id-1');
      expect(item?.orderId).toBe('order-id');
      expect(item?.productId).toBe('product-id');

      expect(item?.productName).toBe('Margherita');
      expect(item?.unitPrice).toBe('55.80');

      expect(item?.quantity).toBe(5);
      expect(item?.notes).toBe('Without onions and tomato.');

      expect(item?.subtotal).toBe('279.00');
    },
  );

  it('should preserve notes when notes are omitted', async () => {
    const { sut, ordersRepository } = makeSut();

    await createOrderWithItem(ordersRepository);

    await sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      itemId: 'item-id-1',
      changes: {
        quantity: 4,
      },
    });

    const order = await ordersRepository.findById('order-id');

    expect(order?.items[0]?.quantity).toBe(4);
    expect(order?.items[0]?.notes).toBe('Without onions');
  });

  it('should preserve quantity when quantity is omitted', async () => {
    const { sut, ordersRepository } = makeSut();

    await createOrderWithItem(ordersRepository);

    await sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      itemId: 'item-id-1',
      changes: {
        notes: 'Without tomato',
      },
    });

    const order = await ordersRepository.findById('order-id');

    expect(order?.items[0]?.quantity).toBe(1);
    expect(order?.items[0]?.notes).toBe('Without tomato');
  });

  it('should allow notes to be cleared with null', async () => {
    const { sut, ordersRepository } = makeSut();

    await createOrderWithItem(ordersRepository);

    await sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      itemId: 'item-id-1',
      changes: {
        notes: null,
      },
    });

    const order = await ordersRepository.findById('order-id');

    expect(order?.items[0]?.notes).toBeNull();
    expect(order?.items[0]?.quantity).toBe(1);
  });

  it('should normalize updated notes through the domain', async () => {
    const { sut, ordersRepository } = makeSut();

    await createOrderWithItem(ordersRepository);

    await sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      itemId: 'item-id-1',
      changes: {
        notes: '  Without tomato  ',
      },
    });

    const order = await ordersRepository.findById('order-id');

    expect(order?.items[0]?.notes).toBe('Without tomato');
  });

  it('should normalize empty notes to null', async () => {
    const { sut, ordersRepository } = makeSut();

    await createOrderWithItem(ordersRepository);

    await sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      itemId: 'item-id-1',
      changes: {
        notes: '   ',
      },
    });

    const order = await ordersRepository.findById('order-id');

    expect(order?.items[0]?.notes).toBeNull();
  });

  it.each([0, -1, 1.5, NaN])(
    'should reject invalid updated quantity %s',
    async (quantity) => {
      const { sut, ordersRepository } = makeSut();

      await createOrderWithItem(ordersRepository);

      const execution = sut.execute({
        actor: makeActor(),
        orderId: 'order-id',
        itemId: 'item-id-1',
        changes: {
          quantity,
        },
      });

      await expect(execution).rejects.toThrow(InvalidQuantityError);

      const order = await ordersRepository.findById('order-id');

      expect(order?.items[0]?.quantity).toBe(1);
    },
  );

  it('should reject updated notes longer than 500 characters', async () => {
    const { sut, ordersRepository } = makeSut();

    await createOrderWithItem(ordersRepository);

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      itemId: 'item-id-1',
      changes: {
        notes: 'a'.repeat(501),
      },
    });

    await expect(execution).rejects.toThrow(InvalidOrderItemError);
    await expect(execution).rejects.toThrow('Notes must not exceed 500 characters.');

    const order = await ordersRepository.findById('order-id');

    expect(order?.items[0]?.notes).toBe('Without onions');
  });

  it('should reject updating an item of a non-draft order', async () => {
    const { sut, ordersRepository } = makeSut();

    const order = makeOrder();

    addItemToOrder(order);

    order.submit(currentDate);

    await ordersRepository.create(order);

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      itemId: 'item-id-1',
      changes: {
        quantity: 5,
      },
    });

    await expect(execution).rejects.toThrow(ConflictError);
    await expect(execution).rejects.toThrow('Only draft orders can update items.');

    const persistedOrder = await ordersRepository.findById('order-id');

    expect(persistedOrder?.items[0]?.quantity).toBe(1);
  });

  it('should reject when the order item does not exist', async () => {
    const { sut, ordersRepository } = makeSut();

    await ordersRepository.create(makeOrder());

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      itemId: 'missing-item-id',
      changes: {
        notes: 'Without basil',
        quantity: 2,
      },
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Order item not found.');

    const order = await ordersRepository.findById('order-id');

    expect(order?.items).toHaveLength(0);
  });

  it('should reject when the item belongs to another order', async () => {
    const { sut, ordersRepository } = makeSut();

    await ordersRepository.create(makeOrder());

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
      changes: {
        quantity: 3,
      },
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Order item not found.');

    const targetOrder = await ordersRepository.findById('order-id');

    const persistedOtherOrder = await ordersRepository.findById('other-order-id');

    expect(targetOrder?.items).toHaveLength(0);
    expect(persistedOtherOrder?.items[0]?.quantity).toBe(1);
  });

  it('should reject when the order does not exist', async () => {
    const { sut } = makeSut();

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'missing-order-id',
      itemId: 'item-id-1',
      changes: {
        quantity: 2,
      },
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
      itemId: 'item-id-1',
      changes: {
        notes: 'Without tomato',
      },
    });

    await expect(execution).rejects.toThrow(ConflictError);
    await expect(execution).rejects.toThrow('Only draft orders can update items.');
  });

  it('should not persist partial changes when one update is invalid', async () => {
    const { sut, ordersRepository } = makeSut();

    await createOrderWithItem(ordersRepository);

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      itemId: 'item-id-1',
      changes: {
        notes: 'New notes',
        quantity: 0,
      },
    });

    await expect(execution).rejects.toThrow(InvalidQuantityError);

    const order = await ordersRepository.findById('order-id');

    expect(order?.items[0]?.quantity).toBe(1);
    expect(order?.items[0]?.notes).toBe('Without onions');
  });
});
