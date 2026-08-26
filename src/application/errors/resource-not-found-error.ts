import { ApplicationError } from './application-error';

class ResourceNotFoundError extends ApplicationError {
  constructor(message: string = 'The requested resource was not found.') {
    super(message);
  }
}

export { ResourceNotFoundError };
