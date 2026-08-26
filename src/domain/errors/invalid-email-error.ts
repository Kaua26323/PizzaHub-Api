import { DomainError } from './domain-error.js';

class InvalidEmailError extends DomainError {
  constructor() {
    super('Email must have a valid format.');
  }
}

export { InvalidEmailError };
