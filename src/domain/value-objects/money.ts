import { InvalidMoneyError } from '../errors/invalid-money-error';

class Money {
  private cents: bigint;
  readonly currency = 'USD' as const;

  constructor(value: string) {
    const cents = Money.parse(value);

    if (cents === null || cents <= 0n) {
      throw new InvalidMoneyError();
    }

    this.cents = cents;
  }

  add(value: Money): Money {
    const result = this.cents + value.cents;

    return new Money(Money.format(result));
  }

  multiply(multiplier: number): Money {
    if (!Number.isSafeInteger(multiplier) || multiplier <= 0) {
      throw new InvalidMoneyError('Multiplier must be a positive integer.');
    }

    const result = this.cents * BigInt(multiplier);

    return new Money(Money.format(result));
  }

  equals(value: Money): boolean {
    return this.cents === value.cents;
  }

  get value(): string {
    return Money.format(this.cents);
  }

  private static parse(value: string): bigint | null {
    const match = /^(0|[1-9]\d*)\.(\d{2})$/.exec(value);

    if (!match) {
      return null;
    }

    const units = match[1];
    const fractionalDigits = match[2];

    if (units === undefined || fractionalDigits === undefined) {
      return null;
    }

    return BigInt(units) * 100n + BigInt(fractionalDigits);
  }

  private static format(cents: bigint): string {
    const units = cents / 100n;
    const fractionalDigits = cents % 100n;

    return `${units.toString()}.${fractionalDigits.toString().padStart(2, '0')}`;
  }
}

export { Money };
