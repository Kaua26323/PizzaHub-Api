import { DomainError } from './domain-error';

class InvalidOrderError extends DomainError {
  constructor(message: string = 'Invalid order.') {
    super(message);
  }
}

export { InvalidOrderError };
