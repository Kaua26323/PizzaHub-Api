import { DomainError } from './domain-error';

class InvalidProductError extends DomainError {
  constructor(message: string = 'Invalid product.') {
    super(message);
  }
}

export { InvalidProductError };
