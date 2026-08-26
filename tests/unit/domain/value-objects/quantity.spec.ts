import { describe, expect, it } from 'vitest';
import { Quantity } from '@/domain/value-objects/quantity';
import { InvalidQuantityError } from '@/domain/errors/invalid-quantity-error';

describe('Domain Quantity (unit)', () => {
  it('should create a Quantity successfully', () => {
    const amount = new Quantity(5);

    expect(amount.value).toBe(5);
  });

  it.each([0, 5.3, -3, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'should reject the invalid quantity "%s"',
    (invalidNumber) => {
      expect(() => new Quantity(invalidNumber)).toThrow(InvalidQuantityError);
    },
  );
});
