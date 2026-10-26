import { ApplicationError } from './application-error';
import type { NotFoundErrorCode } from './application-error';

class ResourceNotFoundError extends ApplicationError {
  constructor(
    code: NotFoundErrorCode,
    message: string = 'The requested resource was not found.',
  ) {
    super(code, message);
  }
}

export { ResourceNotFoundError };
