import { describe, expect, it } from 'vitest';
import { Money } from '@/domain/value-objects/money';
import { InvalidMoneyError } from '@/domain/errors/invalid-money-error';

describe('Domain Money (unit)', () => {
  it.each(['0.01', '5.00', '45.90', '120.00', '90071992547409.93'])(
    'should preserve the canonical value "%s"',
    (value) => {
      const money = new Money(value);

      expect(money.value).toBe(value);
      expect(money.currency).toBe('USD');
    },
  );

  it.each([
    ['0.05', '0.25', '0.30'],
    ['90071992547409.93', '0.07', '90071992547410.00'],
  ])('should add %s and %s exactly', (firstValue, secondValue, expected) => {
    const first = new Money(firstValue);
    const second = new Money(secondValue);

    const result = first.add(second);

    expect(result.value).toBe(expected);
  });

  it('should multiply monetary values exactly', () => {
    const money = new Money('1.30');

    const result = money.multiply(3);

    expect(result.value).toBe('3.90');
  });

  it('should return new values without mutating the original value', () => {
    const original = new Money('10.00');

    const addition = original.add(new Money('5.00'));
    const multiplication = original.multiply(3);

    expect(original.value).toBe('10.00');
    expect(addition.value).toBe('15.00');
    expect(multiplication.value).toBe('30.00');
    expect(addition).not.toBe(original);
    expect(multiplication).not.toBe(original);
  });

  it('should compare monetary values by value', () => {
    const money = new Money('45.90');

    expect(money.equals(new Money('45.90'))).toBe(true);
    expect(money.equals(new Money('45.91'))).toBe(false);
  });

  it.each([
    '',
    '   ',
    '0.00',
    '45',
    '45.9',
    '45.900',
    '$45.90',
    '+45.90',
    '45,90',
    '-45.90',
    '00.01',
    '045.90',
  ])('should reject the invalid value "%s"', (invalidValue) => {
    expect(() => new Money(invalidValue)).toThrow(InvalidMoneyError);
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('should reject the invalid multiplier "%s"', (invalidMultiplier) => {
    const money = new Money('1.00');

    expect(() => money.multiply(invalidMultiplier)).toThrow(InvalidMoneyError);
  });
});
