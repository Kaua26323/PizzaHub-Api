import { ApplicationError } from './application-error';

class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message);
  }
}

export { ValidationError };
