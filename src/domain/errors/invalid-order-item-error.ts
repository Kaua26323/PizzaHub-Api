import { DomainError } from './domain-error';

class InvalidOrderItemError extends DomainError {
  constructor(message: string = 'Invalid order item') {
    super(message);
  }
}

export { InvalidOrderItemError };
