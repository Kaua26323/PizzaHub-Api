import { ApplicationError } from './application-error';

class ConflictError extends ApplicationError {
  constructor(
    message: string = 'The requested operation conflicts with the current resource state.',
  ) {
    super(message);
  }
}

export { ConflictError };
