import { InvalidQuantityError } from '../errors/invalid-quantity-error';

class Quantity {
  readonly value: number;

  constructor(amount: number) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new InvalidQuantityError();
    }
    this.value = amount;
  }
}

export { Quantity };
