import { DomainError } from './domain-error';

class InvalidMoneyError extends DomainError {
  constructor(message: string = 'Money must be a valid USD amount.') {
    super(message);
  }
}

export { InvalidMoneyError };
