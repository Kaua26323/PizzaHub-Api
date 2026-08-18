import { afterEach, describe, expect, it, vi } from 'vitest';

import { Order } from '@/domain/entities/order';
import type {
  OrderProps,
  AddOrderItemProps,
  RestoreOrderProps,
} from '@/domain/entities/order';

import { OrderItem } from '@/domain/entities/order-item';
import type { OrderItemProps } from '@/domain/entities/order-item';

import { InvalidOrderError } from '@/domain/errors/invalid-order-error';
import { InvalidQuantityError } from '@/domain/errors/invalid-quantity-error';

function makeOrderProps(overrides: Partial<OrderProps> = {}): OrderProps {
  return {
    id: 'order-1',
    tableNumber: 10,
    customerName: 'Kaua',
    createdByUserId: 'user-1',
    ...overrides,
  };
}

function makeAddOrderItemProps(
  overrides: Partial<AddOrderItemProps> = {},
): AddOrderItemProps {
  return {
    id: 'item-1',
    productId: 'product-1',
    productName: 'Pizza',
    unitPrice: '19.99',
    quantity: 1,
    notes: null,
    ...overrides,
  };
}

function makeOrderItemProps(overrides: Partial<OrderItemProps> = {}): OrderItemProps {
  return {
    id: 'item-1',
    orderId: 'order-1',
    productId: 'product-1',
    productName: 'Pizza',
    unitPrice: '19.99',
    quantity: 1,
    notes: null,
    ...overrides,
  };
}

function makeOrderItem(overrides: Partial<OrderItemProps> = {}): OrderItem {
  return new OrderItem(makeOrderItemProps(overrides));
}

function makeDraftOrderWithItem(): Order {
  const order = Order.create(makeOrderProps());

  order.addItem(makeAddOrderItemProps());

  return order;
}

function makeRestoreOrderProps(
  overrides: Partial<RestoreOrderProps> = {},
): RestoreOrderProps {
  return {
    id: 'order-1',
    tableNumber: 10,
    customerName: 'Kaua',
    status: 'DRAFT',
    items: [],
    createdByUserId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    submittedAt: null,
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

describe('Domain Order (unit)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('should create a draft order successfully', () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');

      const orderProps = makeOrderProps({ createdAt });

      const order = Order.create(orderProps);

      expect(order.id).toBe(orderProps.id);
      expect(order.tableNumber).toBe(orderProps.tableNumber);
      expect(order.customerName).toBe(orderProps.customerName);
      expect(order.createdByUserId).toBe(orderProps.createdByUserId);

      expect(order.status).toBe('DRAFT');
      expect(order.items).toHaveLength(0);
      expect(order.total).toBe('0.00');

      expect(order.createdAt).toStrictEqual(createdAt);

      expect(order.submittedAt).toBeNull();
      expect(order.completedAt).toBeNull();
      expect(order.cancelledAt).toBeNull();
    });

    it('should use the current date when createdAt is not provided', () => {
      vi.useFakeTimers();

      const now = new Date('2026-01-01T00:00:00.000Z');

      vi.setSystemTime(now);

      const order = Order.create(makeOrderProps());

      expect(order.createdAt).toStrictEqual(now);
    });

    it('should normalize the customer name', () => {
      const order = Order.create(
        makeOrderProps({
          customerName: '  Kaua  ',
        }),
      );

      expect(order.customerName).toBe('Kaua');
    });

    it('should store null when customer name is not provided', () => {
      const props = makeOrderProps();

      delete props.customerName;

      const order = Order.create(props);

      expect(order.customerName).toBeNull();
    });

    it.each([null, '', '   '])(
      'should store null when customer name is %s',
      (customerName) => {
        const order = Order.create(
          makeOrderProps({
            customerName,
          }),
        );

        expect(order.customerName).toBeNull();
      },
    );

    it('should defensively copy createdAt', () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');

      const expectedDate = new Date(createdAt.getTime());

      const order = Order.create(makeOrderProps({ createdAt }));

      createdAt.setFullYear(2000);

      expect(order.createdAt).toStrictEqual(expectedDate);

      const exposedDate = order.createdAt;

      exposedDate.setFullYear(1990);

      expect(order.createdAt).toStrictEqual(expectedDate);
    });

    it.each(['', ' ', ' invalid-id '])('should reject invalid order id "%s"', (id) => {
      expect(() => Order.create(makeOrderProps({ id }))).toThrow(InvalidOrderError);
    });

    it.each([0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])(
      'should reject invalid table number %s',
      (tableNumber) => {
        expect(() =>
          Order.create(
            makeOrderProps({
              tableNumber,
            }),
          ),
        ).toThrow(InvalidOrderError);
      },
    );

    it.each(['', ' ', ' invalid-user-id '])(
      'should reject invalid creator id %s',
      (createdByUserId) => {
        expect(() =>
          Order.create(
            makeOrderProps({
              createdByUserId,
            }),
          ),
        ).toThrow(InvalidOrderError);
      },
    );

    it('should reject an invalid createdAt', () => {
      expect(() =>
        Order.create(
          makeOrderProps({
            createdAt: new Date('invalid'),
          }),
        ),
      ).toThrow(InvalidOrderError);
    });
  });

  describe('items', () => {
    it('should add an item to a draft order', () => {
      const order = Order.create(makeOrderProps());

      order.addItem(
        makeAddOrderItemProps({
          notes: ' No onions ',
        }),
      );

      expect(order.items).toHaveLength(1);

      const item = order.items.at(0);

      expect(item).toBeDefined();
      expect(item?.id).toBe('item-1');
      expect(item?.orderId).toBe(order.id);
      expect(item?.productId).toBe('product-1');
      expect(item?.productName).toBe('Pizza');
      expect(item?.unitPrice).toBe('19.99');
      expect(item?.quantity).toBe(1);
      expect(item?.notes).toBe('No onions');
    });

    it('should allow the same product in multiple distinct items', () => {
      const order = Order.create(makeOrderProps());

      order.addItem(
        makeAddOrderItemProps({
          id: 'item-1',
          productId: 'pizza-1',
          notes: 'No onions',
        }),
      );

      order.addItem(
        makeAddOrderItemProps({
          id: 'item-2',
          productId: 'pizza-1',
          notes: 'Extra onions',
        }),
      );

      expect(order.items).toHaveLength(2);

      expect(order.items.map((item) => item.productId)).toEqual(['pizza-1', 'pizza-1']);

      expect(order.items.map((item) => item.id)).toEqual(['item-1', 'item-2']);
    });

    it('should reject a duplicated order item id', () => {
      const order = Order.create(makeOrderProps());

      order.addItem(
        makeAddOrderItemProps({
          id: 'item-1',
        }),
      );

      expect(() =>
        order.addItem(
          makeAddOrderItemProps({
            id: 'item-1',
            productId: 'product-2',
          }),
        ),
      ).toThrow(InvalidOrderError);

      expect(order.items).toHaveLength(1);
    });

    it('should enforce OrderItem quantity rules when adding an item', () => {
      const order = Order.create(makeOrderProps());

      expect(() =>
        order.addItem(
          makeAddOrderItemProps({
            quantity: 0,
          }),
        ),
      ).toThrow(InvalidQuantityError);

      expect(order.items).toHaveLength(0);
    });

    it('should change an item quantity', () => {
      const order = makeDraftOrderWithItem();

      order.changeItemQuantity('item-1', 5);

      expect(order.items.at(0)?.quantity).toBe(5);
    });

    it('should preserve quantity when an invalid quantity change fails', () => {
      const order = makeDraftOrderWithItem();

      const previousQuantity = order.items.at(0)?.quantity;

      expect(() => order.changeItemQuantity('item-1', 0)).toThrow(InvalidQuantityError);

      expect(order.items.at(0)?.quantity).toBe(previousQuantity);
    });

    it('should change an item notes', () => {
      const order = makeDraftOrderWithItem();

      order.changeItemNotes('item-1', ' Extra cheese ');

      expect(order.items.at(0)?.notes).toBe('Extra cheese');
    });

    it('should clear item notes', () => {
      const order = makeDraftOrderWithItem();

      order.changeItemNotes('item-1', '   ');

      expect(order.items.at(0)?.notes).toBeNull();
    });

    it('should reject changing the quantity of an unknown item', () => {
      const order = makeDraftOrderWithItem();

      expect(() => order.changeItemQuantity('unknown-item', 2)).toThrow(
        InvalidOrderError,
      );
    });

    it('should reject changing the notes of an unknown item', () => {
      const order = makeDraftOrderWithItem();

      expect(() => order.changeItemNotes('unknown-item', 'Notes')).toThrow(
        InvalidOrderError,
      );
    });

    it('should remove an item', () => {
      const order = makeDraftOrderWithItem();

      order.removeItem('item-1');

      expect(order.items).toHaveLength(0);
      expect(order.total).toBe('0.00');
    });

    it('should reject removing an unknown item', () => {
      const order = makeDraftOrderWithItem();

      expect(() => order.removeItem('unknown-item')).toThrow(InvalidOrderError);

      expect(order.items).toHaveLength(1);
    });

    it('should not expose mutable internal OrderItems', () => {
      const order = makeDraftOrderWithItem();

      const exposedItem = order.items.at(0);

      expect(exposedItem).toBeDefined();

      exposedItem?.changeQuantity(100);

      expect(order.items.at(0)?.quantity).toBe(1);
    });
  });

  describe('total', () => {
    it('should return zero for an empty order', () => {
      const order = Order.create(makeOrderProps());

      expect(order.total).toBe('0.00');
    });

    it('should calculate the total using exact historical prices', () => {
      const order = Order.create(makeOrderProps());

      order.addItem(
        makeAddOrderItemProps({
          id: 'item-1',
          unitPrice: '19.99',
          quantity: 3,
        }),
      );

      order.addItem(
        makeAddOrderItemProps({
          id: 'item-2',
          unitPrice: '10.01',
          quantity: 2,
        }),
      );

      expect(order.total).toBe('79.99');
    });

    it('should update the total when item quantity changes', () => {
      const order = makeDraftOrderWithItem();

      expect(order.total).toBe('19.99');

      order.changeItemQuantity('item-1', 3);

      expect(order.total).toBe('59.97');
    });

    it('should preserve the unit price snapshot after adding an item', () => {
      const order = Order.create(makeOrderProps());

      const itemData = makeAddOrderItemProps({
        unitPrice: '20.00',
        quantity: 2,
      });

      order.addItem(itemData);

      itemData.unitPrice = '999.99';

      expect(order.items.at(0)?.unitPrice).toBe('20.00');

      expect(order.total).toBe('40.00');
    });
  });

  describe('submit', () => {
    it('should submit a non-empty draft order', () => {
      const order = makeDraftOrderWithItem();

      const submittedAt = new Date('2026-08-17T13:00:00.000Z');

      order.submit(submittedAt);

      expect(order.status).toBe('IN_PREPARATION');

      expect(order.submittedAt).toStrictEqual(submittedAt);

      expect(order.completedAt).toBeNull();
      expect(order.cancelledAt).toBeNull();
    });

    it('should reject submitting an empty order', () => {
      const order = Order.create(makeOrderProps());

      expect(() => order.submit(new Date('2026-08-17T13:00:00.000Z'))).toThrow(
        InvalidOrderError,
      );

      expect(order.status).toBe('DRAFT');
      expect(order.submittedAt).toBeNull();
    });

    it('should reject an invalid submittedAt without changing state', () => {
      const order = makeDraftOrderWithItem();

      expect(() => order.submit(new Date('invalid'))).toThrow(InvalidOrderError);

      expect(order.status).toBe('DRAFT');
      expect(order.submittedAt).toBeNull();
    });

    it('should reject submitting an order twice', () => {
      const order = makeDraftOrderWithItem();

      order.submit(new Date('2026-08-17T13:00:00.000Z'));

      expect(() => order.submit(new Date('2026-08-17T14:00:00.000Z'))).toThrow(
        InvalidOrderError,
      );
    });
  });

  describe('complete', () => {
    it('should complete an order in preparation', () => {
      const order = makeDraftOrderWithItem();

      order.submit(new Date('2026-08-17T13:00:00.000Z'));

      const completedAt = new Date('2026-08-17T14:00:00.000Z');

      order.complete(completedAt);

      expect(order.status).toBe('COMPLETED');

      expect(order.completedAt).toStrictEqual(completedAt);

      expect(order.cancelledAt).toBeNull();
    });

    it('should reject completing a draft order', () => {
      const order = makeDraftOrderWithItem();

      expect(() => order.complete(new Date('2026-08-17T14:00:00.000Z'))).toThrow(
        InvalidOrderError,
      );

      expect(order.status).toBe('DRAFT');
      expect(order.completedAt).toBeNull();
    });

    it('should reject an invalid completedAt without changing state', () => {
      const order = makeDraftOrderWithItem();

      order.submit(new Date('2026-08-17T13:00:00.000Z'));

      expect(() => order.complete(new Date('invalid'))).toThrow(InvalidOrderError);

      expect(order.status).toBe('IN_PREPARATION');

      expect(order.completedAt).toBeNull();
    });
  });

  describe('cancel', () => {
    it('should cancel a draft order', () => {
      const order = Order.create(makeOrderProps());

      const cancelledAt = new Date('2026-08-17T13:00:00.000Z');

      order.cancel(cancelledAt);

      expect(order.status).toBe('CANCELLED');

      expect(order.cancelledAt).toStrictEqual(cancelledAt);

      expect(order.submittedAt).toBeNull();
      expect(order.completedAt).toBeNull();
    });

    it('should cancel an order in preparation', () => {
      const order = makeDraftOrderWithItem();

      const submittedAt = new Date('2026-08-17T13:00:00.000Z');

      const cancelledAt = new Date('2026-08-17T13:30:00.000Z');

      order.submit(submittedAt);
      order.cancel(cancelledAt);

      expect(order.status).toBe('CANCELLED');

      expect(order.submittedAt).toStrictEqual(submittedAt);

      expect(order.cancelledAt).toStrictEqual(cancelledAt);

      expect(order.completedAt).toBeNull();
    });

    it('should reject cancelling a completed order', () => {
      const order = makeDraftOrderWithItem();

      order.submit(new Date('2026-08-17T13:00:00.000Z'));

      order.complete(new Date('2026-08-17T14:00:00.000Z'));

      expect(() => order.cancel(new Date('2026-08-17T15:00:00.000Z'))).toThrow(
        InvalidOrderError,
      );

      expect(order.status).toBe('COMPLETED');

      expect(order.cancelledAt).toBeNull();
    });

    it('should reject an invalid cancelledAt without changing state', () => {
      const order = makeDraftOrderWithItem();

      expect(() => order.cancel(new Date('invalid'))).toThrow(InvalidOrderError);

      expect(order.status).toBe('DRAFT');
      expect(order.cancelledAt).toBeNull();
    });
  });

  describe('state modification restrictions', () => {
    it('should not allow an order in preparation to have its items modified', () => {
      const order = makeDraftOrderWithItem();

      const submittedAt = new Date('2026-08-17T13:00:00.000Z');

      order.submit(submittedAt);

      expect(() =>
        order.addItem(
          makeAddOrderItemProps({
            id: 'item-2',
          }),
        ),
      ).toThrow(InvalidOrderError);

      expect(() => order.changeItemQuantity('item-1', 2)).toThrow(InvalidOrderError);

      expect(() => order.changeItemNotes('item-1', 'New notes')).toThrow(
        InvalidOrderError,
      );

      expect(() => order.removeItem('item-1')).toThrow(InvalidOrderError);

      expect(order.status).toBe('IN_PREPARATION');
      expect(order.items).toHaveLength(1);
      expect(order.items.at(0)?.quantity).toBe(1);
      expect(order.items.at(0)?.notes).toBeNull();
      expect(order.submittedAt).toStrictEqual(submittedAt);
      expect(order.completedAt).toBeNull();
      expect(order.cancelledAt).toBeNull();
    });

    it('should not allow a completed order to be modified', () => {
      const order = makeDraftOrderWithItem();

      const submittedAt = new Date('2026-08-17T13:00:00.000Z');

      const completedAt = new Date('2026-08-17T14:00:00.000Z');

      order.submit(submittedAt);

      order.complete(completedAt);

      expect(() =>
        order.addItem(
          makeAddOrderItemProps({
            id: 'item-2',
          }),
        ),
      ).toThrow(InvalidOrderError);

      expect(() => order.changeItemQuantity('item-1', 2)).toThrow(InvalidOrderError);

      expect(() => order.changeItemNotes('item-1', 'New notes')).toThrow(
        InvalidOrderError,
      );

      expect(() => order.removeItem('item-1')).toThrow(InvalidOrderError);

      expect(() => order.submit(new Date('2026-08-17T15:00:00.000Z'))).toThrow(
        InvalidOrderError,
      );

      expect(() => order.complete(new Date('2026-08-17T15:00:00.000Z'))).toThrow(
        InvalidOrderError,
      );

      expect(() => order.cancel(new Date('2026-08-17T15:00:00.000Z'))).toThrow(
        InvalidOrderError,
      );

      expect(order.status).toBe('COMPLETED');
      expect(order.items).toHaveLength(1);
      expect(order.items.at(0)?.quantity).toBe(1);
      expect(order.items.at(0)?.notes).toBeNull();
      expect(order.submittedAt).toStrictEqual(submittedAt);
      expect(order.completedAt).toStrictEqual(completedAt);
      expect(order.cancelledAt).toBeNull();
    });

    it('should not allow a cancelled order to be modified or transitioned', () => {
      const order = makeDraftOrderWithItem();

      const cancelledAt = new Date('2026-08-17T13:00:00.000Z');

      order.cancel(cancelledAt);

      expect(() =>
        order.addItem(
          makeAddOrderItemProps({
            id: 'item-2',
          }),
        ),
      ).toThrow(InvalidOrderError);

      expect(() => order.changeItemQuantity('item-1', 2)).toThrow(InvalidOrderError);

      expect(() => order.changeItemNotes('item-1', 'New notes')).toThrow(
        InvalidOrderError,
      );

      expect(() => order.removeItem('item-1')).toThrow(InvalidOrderError);

      expect(() => order.submit(new Date('2026-08-17T14:00:00.000Z'))).toThrow(
        InvalidOrderError,
      );

      expect(() => order.complete(new Date('2026-08-17T14:00:00.000Z'))).toThrow(
        InvalidOrderError,
      );

      expect(() => order.cancel(new Date('2026-08-17T14:00:00.000Z'))).toThrow(
        InvalidOrderError,
      );

      expect(order.status).toBe('CANCELLED');
      expect(order.items).toHaveLength(1);
      expect(order.items.at(0)?.quantity).toBe(1);
      expect(order.items.at(0)?.notes).toBeNull();
      expect(order.submittedAt).toBeNull();
      expect(order.completedAt).toBeNull();
      expect(order.cancelledAt).toStrictEqual(cancelledAt);
    });
  });

  describe('lifecycle date encapsulation', () => {
    it('should defensively copy lifecycle dates', () => {
      const order = makeDraftOrderWithItem();

      const submittedAt = new Date('2026-08-17T13:00:00.000Z');

      const expectedSubmittedAt = new Date(submittedAt.getTime());

      order.submit(submittedAt);

      submittedAt.setFullYear(2000);

      expect(order.submittedAt).toStrictEqual(expectedSubmittedAt);

      const exposedSubmittedAt = order.submittedAt;

      exposedSubmittedAt?.setFullYear(1990);

      expect(order.submittedAt).toStrictEqual(expectedSubmittedAt);
    });
  });

  describe('restore', () => {
    it('should restore a draft order with its items', () => {
      const item = makeOrderItem({
        quantity: 2,
        unitPrice: '19.99',
      });

      const order = Order.restore(
        makeRestoreOrderProps({
          items: [item],
        }),
      );

      expect(order.id).toBe('order-1');
      expect(order.status).toBe('DRAFT');

      expect(order.items).toHaveLength(1);

      expect(order.items.at(0)?.id).toBe('item-1');

      expect(order.total).toBe('39.98');

      expect(order.submittedAt).toBeNull();
      expect(order.completedAt).toBeNull();
      expect(order.cancelledAt).toBeNull();
    });

    it('should restore an order in preparation', () => {
      const submittedAt = new Date('2026-08-17T13:00:00.000Z');

      const order = Order.restore(
        makeRestoreOrderProps({
          status: 'IN_PREPARATION',
          items: [makeOrderItem()],
          submittedAt,
        }),
      );

      expect(order.status).toBe('IN_PREPARATION');

      expect(order.submittedAt).toStrictEqual(submittedAt);

      expect(order.completedAt).toBeNull();
      expect(order.cancelledAt).toBeNull();
    });

    it('should restore a completed order', () => {
      const submittedAt = new Date('2026-08-17T13:00:00.000Z');

      const completedAt = new Date('2026-08-17T14:00:00.000Z');

      const order = Order.restore(
        makeRestoreOrderProps({
          status: 'COMPLETED',
          items: [makeOrderItem()],
          submittedAt,
          completedAt,
        }),
      );

      expect(order.status).toBe('COMPLETED');

      expect(order.submittedAt).toStrictEqual(submittedAt);

      expect(order.completedAt).toStrictEqual(completedAt);

      expect(order.cancelledAt).toBeNull();
    });

    it('should restore an order cancelled while it was a draft', () => {
      const cancelledAt = new Date('2026-08-17T13:00:00.000Z');

      const order = Order.restore(
        makeRestoreOrderProps({
          status: 'CANCELLED',
          cancelledAt,
        }),
      );

      expect(order.status).toBe('CANCELLED');

      expect(order.submittedAt).toBeNull();

      expect(order.cancelledAt).toStrictEqual(cancelledAt);
    });

    it('should restore an order cancelled while it was in preparation', () => {
      const submittedAt = new Date('2026-08-17T13:00:00.000Z');

      const cancelledAt = new Date('2026-08-17T13:30:00.000Z');

      const order = Order.restore(
        makeRestoreOrderProps({
          status: 'CANCELLED',
          items: [makeOrderItem()],
          submittedAt,
          cancelledAt,
        }),
      );

      expect(order.status).toBe('CANCELLED');

      expect(order.submittedAt).toStrictEqual(submittedAt);

      expect(order.cancelledAt).toStrictEqual(cancelledAt);

      expect(order.completedAt).toBeNull();
    });

    const submittedEmptyOrderCases: Array<{
      name: string;
      overrides: Partial<RestoreOrderProps>;
    }> = [
      {
        name: 'IN_PREPARATION',
        overrides: {
          status: 'IN_PREPARATION',
          submittedAt: new Date('2026-08-17T13:00:00.000Z'),
        },
      },
      {
        name: 'COMPLETED',
        overrides: {
          status: 'COMPLETED',
          submittedAt: new Date('2026-08-17T13:00:00.000Z'),
          completedAt: new Date('2026-08-17T14:00:00.000Z'),
        },
      },
      {
        name: 'CANCELLED after submission',
        overrides: {
          status: 'CANCELLED',
          submittedAt: new Date('2026-08-17T13:00:00.000Z'),
          cancelledAt: new Date('2026-08-17T13:30:00.000Z'),
        },
      },
    ];

    it.each(submittedEmptyOrderCases)(
      'should reject restoring an empty submitted order with status $name',
      ({ overrides }) => {
        expect(() =>
          Order.restore(
            makeRestoreOrderProps({
              ...overrides,
              items: [],
            }),
          ),
        ).toThrow(InvalidOrderError);
      },
    );

    it('should reject an invalid restored status', () => {
      expect(() =>
        Order.restore(
          makeRestoreOrderProps({
            status: 'INVALID' as RestoreOrderProps['status'],
          }),
        ),
      ).toThrow(InvalidOrderError);
    });

    const invalidLifecycleCases: Array<{
      name: string;
      overrides: Partial<RestoreOrderProps>;
    }> = [
      {
        name: 'DRAFT with submittedAt',
        overrides: {
          status: 'DRAFT',
          submittedAt: new Date('2026-08-17T13:00:00.000Z'),
        },
      },
      {
        name: 'IN_PREPARATION without submittedAt',
        overrides: {
          status: 'IN_PREPARATION',
          submittedAt: null,
        },
      },
      {
        name: 'IN_PREPARATION with completedAt',
        overrides: {
          status: 'IN_PREPARATION',
          submittedAt: new Date('2026-08-17T13:00:00.000Z'),
          completedAt: new Date('2026-08-17T14:00:00.000Z'),
        },
      },
      {
        name: 'COMPLETED without completedAt',
        overrides: {
          status: 'COMPLETED',
          submittedAt: new Date('2026-08-17T13:00:00.000Z'),
          completedAt: null,
        },
      },
      {
        name: 'COMPLETED with cancelledAt',
        overrides: {
          status: 'COMPLETED',
          submittedAt: new Date('2026-08-17T13:00:00.000Z'),
          completedAt: new Date('2026-08-17T14:00:00.000Z'),
          cancelledAt: new Date('2026-08-17T14:30:00.000Z'),
        },
      },
      {
        name: 'CANCELLED without cancelledAt',
        overrides: {
          status: 'CANCELLED',
          cancelledAt: null,
        },
      },
      {
        name: 'CANCELLED with completedAt',
        overrides: {
          status: 'CANCELLED',
          completedAt: new Date('2026-08-17T14:00:00.000Z'),
          cancelledAt: new Date('2026-08-17T14:30:00.000Z'),
        },
      },
    ];

    it.each(invalidLifecycleCases)(
      'should reject an inconsistent restored lifecycle: $name',
      ({ overrides }) => {
        expect(() => Order.restore(makeRestoreOrderProps(overrides))).toThrow(
          InvalidOrderError,
        );
      },
    );

    it('should reject an item that belongs to another order when restoring', () => {
      const foreignItem = makeOrderItem({
        orderId: 'another-order',
      });

      expect(() =>
        Order.restore(
          makeRestoreOrderProps({
            items: [foreignItem],
          }),
        ),
      ).toThrow(InvalidOrderError);
    });

    it('should reject duplicated item ids when restoring', () => {
      const first = makeOrderItem({
        id: 'item-1',
      });

      const second = makeOrderItem({
        id: 'item-1',
        productId: 'product-2',
      });

      expect(() =>
        Order.restore(
          makeRestoreOrderProps({
            items: [first, second],
          }),
        ),
      ).toThrow(InvalidOrderError);
    });

    it('should clone restored items instead of sharing their references', () => {
      const externalItem = makeOrderItem({
        quantity: 1,
      });

      const order = Order.restore(
        makeRestoreOrderProps({
          items: [externalItem],
        }),
      );

      externalItem.changeQuantity(100);

      expect(order.items.at(0)?.quantity).toBe(1);
    });

    it('should defensively copy restored dates', () => {
      const createdAt = new Date('2026-08-17T12:00:00.000Z');

      const submittedAt = new Date('2026-08-17T13:00:00.000Z');

      const expectedCreatedAt = new Date(createdAt.getTime());

      const expectedSubmittedAt = new Date(submittedAt.getTime());

      const order = Order.restore(
        makeRestoreOrderProps({
          status: 'IN_PREPARATION',
          items: [makeOrderItem()],
          createdAt,
          submittedAt,
        }),
      );

      createdAt.setFullYear(1990);
      submittedAt.setFullYear(1990);

      expect(order.createdAt).toStrictEqual(expectedCreatedAt);

      expect(order.submittedAt).toStrictEqual(expectedSubmittedAt);
    });
  });
});
