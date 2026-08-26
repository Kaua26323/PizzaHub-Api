import { DomainError } from './domain-error';

class InvalidUserError extends DomainError {
  constructor(message: string = 'Invalid user data') {
    super(message);
  }
}

export { InvalidUserError };
