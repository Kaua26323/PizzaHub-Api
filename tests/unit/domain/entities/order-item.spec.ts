import { describe, expect, it } from 'vitest';

import { OrderItem } from '@/domain/entities/order-item';
import type { OrderItemProps } from '@/domain/entities/order-item';
import { InvalidMoneyError } from '@/domain/errors/invalid-money-error';
import { InvalidQuantityError } from '@/domain/errors/invalid-quantity-error';
import { InvalidOrderItemError } from '@/domain/errors/invalid-order-item-error';

function makeOrderItemProps(overrides: Partial<OrderItemProps> = {}): OrderItemProps {
  return {
    id: 'random-order-item-id',
    orderId: 'random-order-id',
    productId: 'random-product-id',
    productName: 'Pizza',
    quantity: 1,
    unitPrice: '90.00',
    notes: 'The best pizza!',
    ...overrides,
  };
}

describe('Domain OrderItem (unit)', () => {
  it('should create an OrderItem successfully', () => {
    const orderItemProps = makeOrderItemProps();
    const orderItem = new OrderItem(orderItemProps);

    expect(orderItem.id).toBe(orderItemProps.id);
    expect(orderItem.orderId).toBe(orderItemProps.orderId);
    expect(orderItem.productId).toBe(orderItemProps.productId);
    expect(orderItem.productName).toBe(orderItemProps.productName);
    expect(orderItem.quantity).toBe(orderItemProps.quantity);
    expect(orderItem.unitPrice).toBe(orderItemProps.unitPrice);
    expect(orderItem.notes).toBe(orderItemProps.notes);
  });

  it('should normalize the product name', () => {
    const orderItem = new OrderItem(makeOrderItemProps({ productName: '  Hamburger ' }));

    expect(orderItem.productName).toBe('Hamburger');
  });

  it('should accept product name with 80 characters', () => {
    const orderItem = new OrderItem(
      makeOrderItemProps({
        productName: 'a'.repeat(80),
      }),
    );

    expect(orderItem.productName).toHaveLength(80);
  });

  it('should normalize the order item notes', () => {
    const orderItem = new OrderItem(makeOrderItemProps({ notes: '  random-notes ' }));

    expect(orderItem.notes).toBe('random-notes');
  });

  it('should store null when notes are empty or not provided', () => {
    const first = new OrderItem(makeOrderItemProps({ notes: '' }));
    const second = new OrderItem(makeOrderItemProps({ notes: '  ' }));
    const third = new OrderItem(makeOrderItemProps({ notes: null }));

    const propsWithoutNotes = makeOrderItemProps();
    delete propsWithoutNotes.notes;

    const fourth = new OrderItem(propsWithoutNotes);

    expect(first.notes).toBe(null);
    expect(second.notes).toBe(null);
    expect(third.notes).toBe(null);
    expect(fourth.notes).toBe(null);
  });

  it('should accept notes with 500 characters', () => {
    const orderItem = new OrderItem(
      makeOrderItemProps({
        notes: 'a'.repeat(500),
      }),
    );

    expect(orderItem.notes).toHaveLength(500);
  });

  it('should change the quantity of an order item', () => {
    const orderItem = new OrderItem(makeOrderItemProps());

    orderItem.changeQuantity(5);

    expect(orderItem.quantity).toBe(5);
  });

  it('should change the order item notes', () => {
    const orderItem = new OrderItem(makeOrderItemProps());

    orderItem.changeNotes(' changing the notes '); // should normalize

    expect(orderItem.notes).toBe('changing the notes');
  });

  it('should clear notes when changing them to an empty value', () => {
    const orderItem = new OrderItem(makeOrderItemProps());

    orderItem.changeNotes('   ');

    expect(orderItem.notes).toBe(null);
  });

  it('should calculate the order item subtotal', () => {
    const orderItem = new OrderItem(
      makeOrderItemProps({
        unitPrice: '19.99',
        quantity: 3,
      }),
    );

    expect(orderItem.subtotal).toBe('59.97');
  });

  it('should reject an invalid id', () => {
    expect(() => new OrderItem(makeOrderItemProps({ id: ' ' }))).toThrow(
      InvalidOrderItemError,
    );

    expect(() => new OrderItem(makeOrderItemProps({ id: ' invalid ' }))).toThrow(
      InvalidOrderItemError,
    );
  });

  it('should reject an invalid orderId', () => {
    expect(() => new OrderItem(makeOrderItemProps({ orderId: ' ' }))).toThrow(
      InvalidOrderItemError,
    );

    expect(() => new OrderItem(makeOrderItemProps({ orderId: ' invalid ' }))).toThrow(
      InvalidOrderItemError,
    );
  });

  it('should reject an invalid productId', () => {
    expect(() => new OrderItem(makeOrderItemProps({ productId: ' ' }))).toThrow(
      InvalidOrderItemError,
    );

    expect(() => new OrderItem(makeOrderItemProps({ productId: ' invalid ' }))).toThrow(
      InvalidOrderItemError,
    );
  });

  it('should reject an invalid product name', () => {
    expect(() => new OrderItem(makeOrderItemProps({ productName: '  ' }))).toThrow(
      InvalidOrderItemError,
    );
    expect(
      () => new OrderItem(makeOrderItemProps({ productName: 'a'.repeat(81) })),
    ).toThrow(InvalidOrderItemError);
  });

  it('should reject an invalid unit price', () => {
    expect(() => new OrderItem(makeOrderItemProps({ unitPrice: '  ' }))).toThrow(
      InvalidMoneyError,
    );

    expect(() => new OrderItem(makeOrderItemProps({ unitPrice: '00.00' }))).toThrow(
      InvalidMoneyError,
    );

    expect(() => new OrderItem(makeOrderItemProps({ unitPrice: '1' }))).toThrow(
      InvalidMoneyError,
    );
  });

  it('should reject an invalid quantity', () => {
    expect(() => new OrderItem(makeOrderItemProps({ quantity: 0 }))).toThrow(
      InvalidQuantityError,
    );

    expect(() => new OrderItem(makeOrderItemProps({ quantity: 1.5 }))).toThrow(
      InvalidQuantityError,
    );

    expect(() => new OrderItem(makeOrderItemProps({ quantity: -1 }))).toThrow(
      InvalidQuantityError,
    );

    expect(
      () => new OrderItem(makeOrderItemProps({ quantity: Number.MAX_SAFE_INTEGER + 1 })),
    ).toThrow(InvalidQuantityError);

    expect(() => new OrderItem(makeOrderItemProps({ quantity: NaN }))).toThrow(
      InvalidQuantityError,
    );
  });

  it('should reject notes longer than 500 characters', () => {
    expect(() => new OrderItem(makeOrderItemProps({ notes: 'a'.repeat(501) }))).toThrow(
      InvalidOrderItemError,
    );
  });

  it('should reject an invalid quantity change', () => {
    const orderItem = new OrderItem(makeOrderItemProps());
    const previousQuantity = orderItem.quantity;

    expect(() => orderItem.changeQuantity(0)).toThrow(InvalidQuantityError);
    expect(() => orderItem.changeQuantity(-1)).toThrow(InvalidQuantityError);

    expect(orderItem.quantity).toBe(previousQuantity);
  });

  it('should reject an invalid notes change', () => {
    const orderItem = new OrderItem(makeOrderItemProps());
    const previousNotes = orderItem.notes;

    expect(() => orderItem.changeNotes('a'.repeat(501))).toThrow(InvalidOrderItemError);

    expect(orderItem.notes).toBe(previousNotes);
  });
});
