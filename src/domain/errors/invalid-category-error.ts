import { DomainError } from './domain-error';

class InvalidCategoryError extends DomainError {
  constructor(message: string = 'Invalid category.') {
    super(message);
  }
}

export { InvalidCategoryError };
