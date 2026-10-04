import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Order } from '@/domain/entities/order';
import type { OrderStatus } from '@/domain/enums/order-status';
import { InvalidOrderError } from '@/domain/errors/invalid-order-error';
import type { AddOrderItemProps, OrderProps } from '@/domain/entities/order';

import { PostgresOrdersRepository } from '@/infrastructure/database/postgres/repositories/postgres-orders-repository';

import { testPool } from '@tests/setup/postgres';

const currentDate = new Date('2026-01-10T13:15:00.000Z');
const laterDate = new Date('2026-01-11T13:15:00.000Z');
const thirdDate = new Date('2026-01-12T13:15:00.000Z');

const submittedAt = new Date('2026-01-10T14:00:00.000Z');
const secondSubmittedAt = new Date('2026-01-11T14:00:00.000Z');
const completedAt = new Date('2026-01-10T15:00:00.000Z');
const cancelledAt = new Date('2026-01-10T15:30:00.000Z');

const userId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';
const missingProductId = '44444444-4444-4444-8444-444444444444';

const orderId = '55555555-5555-4555-8555-555555555555';
const secondOrderId = '66666666-6666-4666-8666-666666666666';
const thirdOrderId = '77777777-7777-4777-8777-777777777777';
const missingOrderId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const firstItemId = '88888888-8888-4888-8888-888888888888';
const secondItemId = '99999999-9999-4999-8999-999999999999';

const thirdItemId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type OrderRow = {
  id: string;
  table_number: number;
  customer_name: string | null;
  status: OrderStatus;
  created_by_user_id: string;
  created_at: Date;
  submitted_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: string;
  quantity: number;
  notes: string | null;
};

function makeSut(): PostgresOrdersRepository {
  return new PostgresOrdersRepository(testPool);
}

function makeOrder(overrides: Partial<OrderProps> = {}): Order {
  return Order.create({
    id: orderId,
    tableNumber: 10,
    customerName: 'Kaua',
    createdByUserId: userId,
    createdAt: currentDate,
    ...overrides,
  });
}

function makeOrderItemProps(
  overrides: Partial<AddOrderItemProps> = {},
): AddOrderItemProps {
  return {
    id: firstItemId,
    productId,
    productName: 'Calabresa',
    unitPrice: '49.90',
    quantity: 1,
    notes: null,
    ...overrides,
  };
}

async function insertUser(): Promise<void> {
  await testPool.query(
    `
      INSERT INTO users (
        id,
        name,
        email,
        password_hash,
        role,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7
      );
    `,
    [
      userId,
      'Kaua',
      'kaua@example.com',
      'hashed-password',
      'STAFF',
      currentDate,
      currentDate,
    ],
  );
}

async function insertCategory(): Promise<void> {
  await testPool.query(
    `
      INSERT INTO categories (
        id,
        name,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4
      );
    `,
    [categoryId, 'Pizzas', currentDate, currentDate],
  );
}

async function insertProduct(): Promise<void> {
  await testPool.query(
    `
      INSERT INTO products (
        id,
        name,
        description,
        price,
        image_key,
        image_mime_type,
        image_size,
        is_active,
        category_id,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11
      );
    `,
    [
      productId,
      'Calabresa',
      'Pizza de calabresa',
      '49.90',
      'products/calabresa.webp',
      'image/webp',
      1024,
      true,
      categoryId,
      currentDate,
      currentDate,
    ],
  );
}

async function insertOrder(order: Order): Promise<void> {
  await testPool.query(
    `
      INSERT INTO orders (
        id,
        table_number,
        customer_name,
        status,
        created_by_user_id,
        created_at,
        submitted_at,
        completed_at,
        cancelled_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9
      );
    `,
    [
      order.id,
      order.tableNumber,
      order.customerName,
      order.status,
      order.createdByUserId,
      order.createdAt,
      order.submittedAt,
      order.completedAt,
      order.cancelledAt,
    ],
  );
}

async function insertOrderItems(order: Order): Promise<void> {
  for (const item of order.items) {
    await testPool.query(
      `
        INSERT INTO order_items (
          id,
          order_id,
          product_id,
          product_name,
          unit_price,
          quantity,
          notes
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7
        );
      `,
      [
        item.id,
        item.orderId,
        item.productId,
        item.productName,
        item.unitPrice,
        item.quantity,
        item.notes,
      ],
    );
  }
}

async function insertOrderAggregate(order: Order): Promise<void> {
  await insertOrder(order);
  await insertOrderItems(order);
}

async function findOrderRow(id: string): Promise<OrderRow | null> {
  const result = await testPool.query<OrderRow>(
    `
      SELECT
        id,
        table_number,
        customer_name,
        status,
        created_by_user_id,
        created_at,
        submitted_at,
        completed_at,
        cancelled_at
      FROM orders
      WHERE id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

async function findOrderItemRows(orderId: string): Promise<OrderItemRow[]> {
  const result = await testPool.query<OrderItemRow>(
    `
      SELECT
        id,
        order_id,
        product_id,
        product_name,
        unit_price,
        quantity,
        notes
      FROM order_items
      WHERE order_id = $1
      ORDER BY id;
    `,
    [orderId],
  );

  return result.rows;
}

function expectOrderFields(result: Order, expected: Order): void {
  expect(result).toBeInstanceOf(Order);

  expect(result.id).toBe(expected.id);
  expect(result.tableNumber).toBe(expected.tableNumber);
  expect(result.customerName).toBe(expected.customerName);
  expect(result.status).toBe(expected.status);
  expect(result.createdByUserId).toBe(expected.createdByUserId);

  expect(result.createdAt).toStrictEqual(expected.createdAt);
  expect(result.submittedAt).toStrictEqual(expected.submittedAt);
  expect(result.completedAt).toStrictEqual(expected.completedAt);
  expect(result.cancelledAt).toStrictEqual(expected.cancelledAt);
}

beforeEach(async () => {
  await insertUser();
  await insertCategory();
  await insertProduct();
});

describe('PostgresOrdersRepository', () => {
  describe('create', () => {
    it('should create an order', async () => {
      const sut = makeSut();

      const order = makeOrder();

      await sut.create(order);

      const persistedOrder = await findOrderRow(order.id);

      expect(persistedOrder).not.toBeNull();

      expect(persistedOrder?.id).toBe(order.id);
      expect(persistedOrder?.table_number).toBe(order.tableNumber);
      expect(persistedOrder?.customer_name).toBe(order.customerName);
      expect(persistedOrder?.status).toBe('DRAFT');

      expect(persistedOrder?.created_by_user_id).toBe(order.createdByUserId);

      expect(persistedOrder?.created_at).toStrictEqual(order.createdAt);

      expect(persistedOrder?.submitted_at).toBeNull();
      expect(persistedOrder?.completed_at).toBeNull();
      expect(persistedOrder?.cancelled_at).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return an order without items', async () => {
      const sut = makeSut();

      const order = makeOrder();

      await insertOrder(order);

      const result = await sut.findById(order.id);

      expect(result).not.toBeNull();
      expectOrderFields(result!, order);
      expect(result?.items).toEqual([]);
    });

    it('should return an order with its items', async () => {
      const sut = makeSut();

      const order = makeOrder();

      order.addItem(
        makeOrderItemProps({
          id: firstItemId,
          quantity: 2,
          notes: 'Without onions',
        }),
      );

      order.addItem(
        makeOrderItemProps({
          id: secondItemId,
          quantity: 1,
          notes: 'Extra onions',
        }),
      );

      await insertOrderAggregate(order);

      const result = await sut.findById(order.id);

      expect(result).not.toBeNull();

      expectOrderFields(result!, order);

      expect(result?.items).toHaveLength(2);
      expect(result?.items.map((item) => item.id)).toEqual([firstItemId, secondItemId]);

      expect(result?.items[0]?.productId).toBe(productId);
      expect(result?.items[0]?.productName).toBe('Calabresa');
      expect(result?.items[0]?.unitPrice).toBe('49.90');
      expect(result?.items[0]?.quantity).toBe(2);
      expect(result?.items[0]?.notes).toBe('Without onions');

      expect(result?.items[1]?.productId).toBe(productId);
      expect(result?.items[1]?.productName).toBe('Calabresa');
      expect(result?.items[1]?.unitPrice).toBe('49.90');
      expect(result?.items[1]?.quantity).toBe(1);
      expect(result?.items[1]?.notes).toBe('Extra onions');
    });

    it('should preserve repeated products as distinct order items', async () => {
      const sut = makeSut();

      const order = makeOrder();

      order.addItem(
        makeOrderItemProps({
          id: firstItemId,
          notes: 'Without onions',
        }),
      );

      order.addItem(
        makeOrderItemProps({
          id: secondItemId,
          notes: 'Extra onions',
        }),
      );

      await insertOrderAggregate(order);

      const result = await sut.findById(order.id);

      expect(result).not.toBeNull();
      expect(result?.items).toHaveLength(2);

      expect(result?.items[0]?.productId).toBe(productId);
      expect(result?.items[1]?.productId).toBe(productId);

      expect(result?.items[0]?.id).not.toBe(result?.items[1]?.id);
    });

    it('should preserve item name and price after the product changes', async () => {
      const sut = makeSut();

      const order = makeOrder();
      order.addItem(makeOrderItemProps());

      await insertOrderAggregate(order);
      await testPool.query('UPDATE products SET name = $1, price = $2 WHERE id = $3', [
        'Updated Pizza',
        '59.90',
        productId,
      ]);

      const result = await sut.findById(order.id);

      expect(result?.items[0]?.productName).toBe('Calabresa');
      expect(result?.items[0]?.unitPrice).toBe('49.90');
    });

    it('should return null when the order does not exist', async () => {
      const sut = makeSut();

      const result = await sut.findById(missingOrderId);

      expect(result).toBeNull();
    });
  });

  describe('listAll', () => {
    it('should return all orders with their respective items ordered by creation date', async () => {
      const sut = makeSut();

      const firstOrder = makeOrder({
        id: orderId,
        createdAt: currentDate,
      });

      firstOrder.addItem(
        makeOrderItemProps({
          id: firstItemId,
        }),
      );

      const secondOrder = makeOrder({
        id: secondOrderId,
        tableNumber: 20,
        createdAt: laterDate,
      });

      secondOrder.addItem(
        makeOrderItemProps({
          id: secondItemId,
        }),
      );

      secondOrder.submit(secondSubmittedAt);

      const thirdOrder = makeOrder({
        id: thirdOrderId,
        tableNumber: 30,
        createdAt: thirdDate,
      });

      await insertOrderAggregate(firstOrder);
      await insertOrderAggregate(secondOrder);
      await insertOrderAggregate(thirdOrder);

      const result = await sut.listAll();

      expect(result).toHaveLength(3);

      expect(result.map((order) => order.id)).toEqual([
        firstOrder.id,
        secondOrder.id,
        thirdOrder.id,
      ]);

      expect(result[0]?.items).toHaveLength(1);
      expect(result[1]?.items).toHaveLength(1);
      expect(result[2]?.items).toEqual([]);
    });

    it('should return only orders matching the status filter', async () => {
      const sut = makeSut();

      const draftOrder = makeOrder({
        id: orderId,
      });

      draftOrder.addItem(
        makeOrderItemProps({
          id: firstItemId,
        }),
      );

      const preparingOrder = makeOrder({
        id: secondOrderId,
      });

      preparingOrder.addItem(
        makeOrderItemProps({
          id: secondItemId,
        }),
      );

      preparingOrder.submit(submittedAt);

      await insertOrderAggregate(draftOrder);
      await insertOrderAggregate(preparingOrder);

      const result = await sut.listAll({
        status: 'IN_PREPARATION',
      });

      expect(result).toHaveLength(1);

      expect(result[0]?.id).toBe(preparingOrder.id);
      expect(result[0]?.status).toBe('IN_PREPARATION');
      expect(result[0]?.items).toHaveLength(1);
    });

    it('should return an empty array when there are no orders', async () => {
      const sut = makeSut();

      const result = await sut.listAll();

      expect(result).toEqual([]);
    });

    it('should return an empty array when no order matches the status filter', async () => {
      const sut = makeSut();

      const order = makeOrder();

      await insertOrder(order);

      const result = await sut.listAll({
        status: 'COMPLETED',
      });

      expect(result).toEqual([]);
    });
  });

  describe('save', () => {
    it('should return not-found when the order does not exist', async () => {
      const sut = makeSut();

      const change = vi.fn();

      const result = await sut.save(missingOrderId, change);

      expect(result).toEqual({
        status: 'not-found',
      });

      expect(change).not.toHaveBeenCalled();
    });

    it('should add an order item', async () => {
      const sut = makeSut();

      const order = makeOrder();

      await insertOrder(order);

      const result = await sut.save(order.id, (currentOrder) => {
        currentOrder.addItem(makeOrderItemProps());
      });

      expect(result).toEqual({
        status: 'saved',
      });

      const items = await findOrderItemRows(order.id);

      expect(items).toHaveLength(1);

      expect(items[0]).toMatchObject({
        id: firstItemId,
        order_id: order.id,
        product_id: productId,
        product_name: 'Calabresa',
        unit_price: '49.90',
        quantity: 1,
        notes: null,
      });
    });

    it('should update an existing order item', async () => {
      const sut = makeSut();

      const order = makeOrder();

      order.addItem(
        makeOrderItemProps({
          quantity: 1,
          notes: null,
        }),
      );

      await insertOrderAggregate(order);

      const result = await sut.save(order.id, (currentOrder) => {
        currentOrder.changeItemQuantity(firstItemId, 3);
        currentOrder.changeItemNotes(firstItemId, 'Well done');
      });

      expect(result).toEqual({
        status: 'saved',
      });

      const items = await findOrderItemRows(order.id);

      expect(items).toHaveLength(1);

      expect(items[0]?.quantity).toBe(3);
      expect(items[0]?.notes).toBe('Well done');

      expect(items[0]?.product_id).toBe(productId);
      expect(items[0]?.product_name).toBe('Calabresa');
      expect(items[0]?.unit_price).toBe('49.90');
    });

    it('should remove an order item', async () => {
      const sut = makeSut();

      const order = makeOrder();

      order.addItem(
        makeOrderItemProps({
          id: firstItemId,
        }),
      );

      order.addItem(
        makeOrderItemProps({
          id: secondItemId,
        }),
      );

      await insertOrderAggregate(order);

      const result = await sut.save(order.id, (currentOrder) => {
        currentOrder.removeItem(firstItemId);
      });

      expect(result).toEqual({
        status: 'saved',
      });

      const items = await findOrderItemRows(order.id);

      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(secondItemId);
    });

    it('should persist added, removed, and modified items in the same save operation', async () => {
      const sut = makeSut();

      const order = makeOrder();

      order.addItem(
        makeOrderItemProps({
          id: firstItemId,
          quantity: 1,
          notes: null,
        }),
      );

      order.addItem(
        makeOrderItemProps({
          id: secondItemId,
          quantity: 1,
          notes: 'Remove me',
        }),
      );

      await insertOrderAggregate(order);

      const result = await sut.save(order.id, (currentOrder) => {
        currentOrder.changeItemQuantity(firstItemId, 4);
        currentOrder.changeItemNotes(firstItemId, 'Modified');

        currentOrder.removeItem(secondItemId);

        currentOrder.addItem(
          makeOrderItemProps({
            id: thirdItemId,
            quantity: 2,
            notes: 'New item',
          }),
        );
      });

      expect(result).toEqual({
        status: 'saved',
      });

      const items = await findOrderItemRows(order.id);

      expect(items).toHaveLength(2);

      const modifiedItem = items.find((item) => item.id === firstItemId);
      const removedItem = items.find((item) => item.id === secondItemId);
      const addedItem = items.find((item) => item.id === thirdItemId);

      expect(modifiedItem).toMatchObject({
        quantity: 4,
        notes: 'Modified',
      });

      expect(removedItem).toBeUndefined();

      expect(addedItem).toMatchObject({
        product_id: productId,
        product_name: 'Calabresa',
        unit_price: '49.90',
        quantity: 2,
        notes: 'New item',
      });
    });

    it('should preserve repeated products as distinct items when saving', async () => {
      const sut = makeSut();

      const order = makeOrder();

      await insertOrder(order);

      await sut.save(order.id, (currentOrder) => {
        currentOrder.addItem(
          makeOrderItemProps({
            id: firstItemId,
            notes: 'Without onions',
          }),
        );

        currentOrder.addItem(
          makeOrderItemProps({
            id: secondItemId,
            notes: 'Extra onions',
          }),
        );
      });

      const items = await findOrderItemRows(order.id);

      expect(items).toHaveLength(2);

      expect(items.every((item) => item.product_id === productId)).toBe(true);

      expect(new Set(items.map((item) => item.id)).size).toBe(2);

      expect(items.map((item) => item.notes)).toEqual(['Without onions', 'Extra onions']);
    });

    it('should submit an order and persist its lifecycle state', async () => {
      const sut = makeSut();

      const order = makeOrder();

      order.addItem(makeOrderItemProps());

      await insertOrderAggregate(order);

      const result = await sut.save(order.id, (currentOrder) => {
        currentOrder.submit(submittedAt);
      });

      expect(result).toEqual({
        status: 'saved',
      });

      const persistedOrder = await findOrderRow(order.id);

      expect(persistedOrder?.status).toBe('IN_PREPARATION');

      expect(persistedOrder?.submitted_at).toStrictEqual(submittedAt);

      expect(persistedOrder?.completed_at).toBeNull();
      expect(persistedOrder?.cancelled_at).toBeNull();
    });

    it('should complete an order and persist completed_at', async () => {
      const sut = makeSut();

      const order = makeOrder();

      order.addItem(makeOrderItemProps());

      order.submit(submittedAt);

      await insertOrderAggregate(order);

      const result = await sut.save(order.id, (currentOrder) => {
        currentOrder.complete(completedAt);
      });

      expect(result).toEqual({
        status: 'saved',
      });

      const persistedOrder = await findOrderRow(order.id);

      expect(persistedOrder?.status).toBe('COMPLETED');
      expect(persistedOrder?.submitted_at).toStrictEqual(submittedAt);
      expect(persistedOrder?.completed_at).toStrictEqual(completedAt);
      expect(persistedOrder?.cancelled_at).toBeNull();
    });

    it('should cancel an order and persist cancelled_at', async () => {
      const sut = makeSut();

      const order = makeOrder();

      order.addItem(makeOrderItemProps());

      order.submit(submittedAt);

      await insertOrderAggregate(order);

      const result = await sut.save(order.id, (currentOrder) => {
        currentOrder.cancel(cancelledAt);
      });

      expect(result).toEqual({
        status: 'saved',
      });

      const persistedOrder = await findOrderRow(order.id);

      expect(persistedOrder?.status).toBe('CANCELLED');
      expect(persistedOrder?.submitted_at).toStrictEqual(submittedAt);
      expect(persistedOrder?.completed_at).toBeNull();
      expect(persistedOrder?.cancelled_at).toStrictEqual(cancelledAt);
    });

    it('should rollback all changes when persisting one of the item changes fails', async () => {
      const sut = makeSut();

      const order = makeOrder();

      order.addItem(
        makeOrderItemProps({
          id: firstItemId,
        }),
      );

      await insertOrderAggregate(order);

      await expect(
        sut.save(order.id, (currentOrder) => {
          currentOrder.removeItem(firstItemId);

          currentOrder.addItem(
            makeOrderItemProps({
              id: secondItemId,
              productId: missingProductId,
            }),
          );
        }),
      ).rejects.toMatchObject({
        code: '23503',
      });

      const items = await findOrderItemRows(order.id);

      /*
       * The repository deletes removed items before inserting
       * added items.
       *
       * The INSERT fails because missingProductId violates the
       * foreign key constraint. The transaction must rollback
       * the previous DELETE.
       */
      expect(items).toHaveLength(1);

      expect(items[0]?.id).toBe(firstItemId);
      expect(items[0]?.product_id).toBe(productId);
    });

    it('should allow only one concurrent terminal transition to succeed', async () => {
      const sut = makeSut();

      const order = makeOrder();

      order.addItem(makeOrderItemProps());

      order.submit(submittedAt);

      await insertOrderAggregate(order);

      const completePromise = sut.save(order.id, (currentOrder) => {
        currentOrder.complete(completedAt);
      });

      const cancelPromise = sut.save(order.id, (currentOrder) => {
        currentOrder.cancel(cancelledAt);
      });

      const results = await Promise.allSettled([completePromise, cancelPromise]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');

      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      if (fulfilled[0]?.status === 'fulfilled') {
        expect(fulfilled[0].value).toEqual({
          status: 'saved',
        });
      }

      const persistedOrder = await findOrderRow(order.id);

      expect(['COMPLETED', 'CANCELLED']).toContain(persistedOrder?.status);

      if (persistedOrder?.status === 'COMPLETED') {
        expect(persistedOrder.completed_at).toStrictEqual(completedAt);

        expect(persistedOrder.cancelled_at).toBeNull();
      }

      if (persistedOrder?.status === 'CANCELLED') {
        expect(persistedOrder.cancelled_at).toStrictEqual(cancelledAt);

        expect(persistedOrder.completed_at).toBeNull();
      }
    });

    it('should serialize concurrent changes to the same item quantity', async () => {
      const sut = makeSut();

      const order = makeOrder();
      order.addItem(makeOrderItemProps());

      await insertOrderAggregate(order);

      const incrementQuantity = () =>
        sut.save(order.id, (currentOrder) => {
          const quantity = currentOrder.items[0]?.quantity;
          if (quantity === undefined) throw new Error('Expected an order item.');
          currentOrder.changeItemQuantity(firstItemId, quantity + 1);
        });

      const results = await Promise.all([incrementQuantity(), incrementQuantity()]);

      expect(results).toEqual([{ status: 'saved' }, { status: 'saved' }]);
      expect((await findOrderItemRows(order.id))[0]?.quantity).toBe(3);
    });

    it('should serialize item changes with order submission', async () => {
      const sut = makeSut();

      const order = makeOrder();
      order.addItem(makeOrderItemProps());

      await insertOrderAggregate(order);

      const results = await Promise.allSettled([
        sut.save(order.id, (currentOrder) => currentOrder.submit(submittedAt)),
        sut.save(order.id, (currentOrder) => {
          currentOrder.addItem(makeOrderItemProps({ id: secondItemId }));
        }),
      ]);

      expect(results[0]).toMatchObject({
        status: 'fulfilled',
        value: { status: 'saved' },
      });

      const persistedOrder = await findOrderRow(order.id);
      const items = await findOrderItemRows(order.id);

      expect(persistedOrder?.status).toBe('IN_PREPARATION');
      expect(persistedOrder?.submitted_at).toStrictEqual(submittedAt);

      if (results[1]?.status === 'fulfilled') {
        expect(items.map((item) => item.id)).toEqual([firstItemId, secondItemId]);
      } else {
        expect(results[1]?.reason).toBeInstanceOf(InvalidOrderError);
        expect(items.map((item) => item.id)).toEqual([firstItemId]);
      }
    });
  });
});
