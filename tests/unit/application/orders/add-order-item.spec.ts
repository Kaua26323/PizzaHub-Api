import { describe, expect, it, vi } from 'vitest';

import { Order } from '@/domain/entities/order';
import type { OrderProps } from '@/domain/entities/order';

import { Product } from '@/domain/entities/product';
import type { ProductProps } from '@/domain/entities/product';

import { InvalidQuantityError } from '@/domain/errors/invalid-quantity-error';
import { InvalidOrderItemError } from '@/domain/errors/invalid-order-item-error';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import { AddOrderItemUseCase } from '@/application/use-cases/orders/add-order-item';

import { FakeIdGenerator } from '@tests/doubles/services/fake-id-generator';
import { InMemoryOrdersRepository } from '@tests/doubles/repositories/in-memory-orders-repository';
import { InMemoryProductsRepository } from '@tests/doubles/repositories/in-memory-products-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const idGenerator = new FakeIdGenerator(['item-1', 'item-2']);
  const ordersRepository = new InMemoryOrdersRepository();
  const productsRepository = new InMemoryProductsRepository();

  const sut = new AddOrderItemUseCase(idGenerator, productsRepository, ordersRepository);

  return {
    sut,
    idGenerator,
    ordersRepository,
    productsRepository,
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

function makeProduct(overrides: Partial<ProductProps> = {}): Product {
  return new Product({
    id: 'product-id',
    name: 'Margherita',
    description: 'Tomato sauce, mozzarella and basil.',
    price: '39.90',
    imageKey: 'product.webp',
    imageMimeType: 'image/webp',
    imageSize: 5_000,
    categoryId: 'category-id',
    isActive: true,
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

describe('AddOrderItemUseCase', () => {
  it.each(['ADMIN', 'STAFF'] as const)(
    'should allow an %s actor to add an item to a draft order',
    async (role) => {
      const { sut, ordersRepository, productsRepository } = makeSut();

      await ordersRepository.create(makeOrder());
      await productsRepository.create(makeProduct());

      await sut.execute({
        actor: makeActor({ role }),
        orderId: 'order-id',
        productId: 'product-id',
        item: {
          quantity: 2,
          notes: '  Without onions  ',
        },
      });

      const order = await ordersRepository.findById('order-id');

      expect(order).not.toBeNull();
      expect(order?.items).toHaveLength(1);

      const savedItem = order?.items[0];

      expect(savedItem?.id).toBe('item-1');
      expect(savedItem?.orderId).toBe('order-id');
      expect(savedItem?.productId).toBe('product-id');
      expect(savedItem?.productName).toBe('Margherita');
      expect(savedItem?.unitPrice).toBe('39.90');
      expect(savedItem?.quantity).toBe(2);
      expect(savedItem?.notes).toBe('Without onions');
      expect(savedItem?.subtotal).toBe('79.80');
    },
  );

  it('should store omitted notes as null', async () => {
    const { sut, ordersRepository, productsRepository } = makeSut();

    await ordersRepository.create(makeOrder());
    await productsRepository.create(makeProduct());

    await sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      productId: 'product-id',
      item: {
        quantity: 1,
      },
    });

    const order = await ordersRepository.findById('order-id');

    expect(order?.items[0]?.notes).toBeNull();
  });

  it('should create distinct items when the same product is added twice', async () => {
    const { sut, ordersRepository, productsRepository } = makeSut();

    await ordersRepository.create(makeOrder());
    await productsRepository.create(makeProduct());

    await sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      productId: 'product-id',
      item: {
        quantity: 1,
        notes: 'Without onions',
      },
    });

    await sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      productId: 'product-id',
      item: {
        quantity: 2,
        notes: 'Extra cheese',
      },
    });

    const order = await ordersRepository.findById('order-id');

    expect(order?.items).toHaveLength(2);
    expect(order?.items.map((item) => item.id)).toEqual(['item-1', 'item-2']);
    expect(order?.items.map((item) => item.productId)).toEqual([
      'product-id',
      'product-id',
    ]);
    expect(order?.items.map((item) => item.notes)).toEqual([
      'Without onions',
      'Extra cheese',
    ]);
  });

  it('should reject when the order does not exist', async () => {
    const { sut, idGenerator, ordersRepository } = makeSut();

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'missing-order-id',
      productId: 'product-id',
      item: {
        quantity: 1,
      },
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Order not found.');

    expect(ordersRepository.orders).toHaveLength(0);
    expect(idGenerator.generatedIds).toHaveLength(0);
  });

  it('should reject adding items to a non-draft order', async () => {
    const { sut, ordersRepository, productsRepository } = makeSut();

    const order = makeOrder();

    order.addItem({
      id: 'existing-item-id',
      productId: 'product-id',
      productName: 'Margherita',
      unitPrice: '39.90',
      quantity: 1,
      notes: null,
    });

    order.submit(currentDate);

    await ordersRepository.create(order);
    await productsRepository.create(makeProduct());

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      productId: 'product-id',
      item: {
        quantity: 1,
      },
    });

    await expect(execution).rejects.toThrow(ConflictError);
    await expect(execution).rejects.toThrow('Only draft orders can have items added.');

    const persistedOrder = await ordersRepository.findById('order-id');

    expect(persistedOrder?.items).toHaveLength(1);
  });

  it('should reject when the product does not exist', async () => {
    const { sut, idGenerator, ordersRepository } = makeSut();

    await ordersRepository.create(makeOrder());

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      productId: 'missing-product-id',
      item: {
        quantity: 1,
      },
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Product not found.');

    const order = await ordersRepository.findById('order-id');

    expect(order?.items).toHaveLength(0);
    expect(idGenerator.generatedIds).toHaveLength(0);
  });

  it('should reject an inactive product', async () => {
    const { sut, idGenerator, ordersRepository, productsRepository } = makeSut();

    await ordersRepository.create(makeOrder());
    await productsRepository.create(
      makeProduct({
        isActive: false,
      }),
    );

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      productId: 'product-id',
      item: {
        quantity: 1,
      },
    });

    await expect(execution).rejects.toThrow(ConflictError);
    await expect(execution).rejects.toThrow(
      'Inactive products cannot be added to an order.',
    );

    const order = await ordersRepository.findById('order-id');

    expect(order?.items).toHaveLength(0);
    expect(idGenerator.generatedIds).toHaveLength(0);
  });

  it.each([0, -1, 1.5, NaN])('should reject invalid quantity %s', async (quantity) => {
    const { sut, ordersRepository, productsRepository } = makeSut();

    await ordersRepository.create(makeOrder());
    await productsRepository.create(makeProduct());

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      productId: 'product-id',
      item: {
        quantity,
      },
    });

    await expect(execution).rejects.toThrow(InvalidQuantityError);

    const order = await ordersRepository.findById('order-id');

    expect(order?.items).toHaveLength(0);
  });

  it('should reject notes longer than 500 characters', async () => {
    const { sut, ordersRepository, productsRepository } = makeSut();

    await ordersRepository.create(makeOrder());
    await productsRepository.create(makeProduct());

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      productId: 'product-id',
      item: {
        quantity: 1,
        notes: 'a'.repeat(501),
      },
    });

    await expect(execution).rejects.toThrow(InvalidOrderItemError);
    await expect(execution).rejects.toThrow('Notes must not exceed 500 characters.');

    const order = await ordersRepository.findById('order-id');

    expect(order?.items).toHaveLength(0);
  });
  it('should reject when the order disappears before saving', async () => {
    const { sut, idGenerator, ordersRepository, productsRepository } = makeSut();

    await ordersRepository.create(makeOrder());
    await productsRepository.create(makeProduct());

    vi.spyOn(ordersRepository, 'save').mockResolvedValueOnce({
      status: 'not-found',
    });

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      productId: 'product-id',
      item: {
        quantity: 1,
      },
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Order not found.');
    expect(idGenerator.generatedIds).toHaveLength(0);
  });

  it('should reject when the order stops being DRAFT before saving', async () => {
    const { sut, ordersRepository, productsRepository } = makeSut();

    const order = makeOrder();

    order.addItem({
      id: 'existing-item-id',
      productId: 'product-id',
      productName: 'Margherita',
      unitPrice: '39.90',
      quantity: 1,
      notes: null,
    });

    await ordersRepository.create(order);
    await productsRepository.create(makeProduct());

    vi.spyOn(ordersRepository, 'save').mockImplementationOnce(
      async (_orderId, change) => {
        const currentOrder = await ordersRepository.findById('order-id');

        if (!currentOrder) {
          return { status: 'not-found' };
        }

        currentOrder.submit(currentDate);

        change(currentOrder);

        return { status: 'saved' };
      },
    );

    const execution = sut.execute({
      actor: makeActor(),
      orderId: 'order-id',
      productId: 'product-id',
      item: {
        quantity: 1,
      },
    });

    await expect(execution).rejects.toThrow(ConflictError);

    await expect(execution).rejects.toThrow('Only draft orders can have items added.');
  });
});
