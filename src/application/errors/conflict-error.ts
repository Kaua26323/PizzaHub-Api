import { ApplicationError } from './application-error';
import type { ConflictErrorCode } from './application-error';

class ConflictError extends ApplicationError {
  constructor(
    code: ConflictErrorCode,
    message: string = 'The requested operation conflicts with the current resource state.',
  ) {
    super(code, message);
  }
}

export { ConflictError };
