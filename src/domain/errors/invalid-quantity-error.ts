import { DomainError } from './domain-error';

class InvalidQuantityError extends DomainError {
  constructor() {
    super('Quantity must be a positive integer.');
  }
}

export { InvalidQuantityError };
