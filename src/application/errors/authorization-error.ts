import { ApplicationError } from './application-error';
import type { AuthorizationErrorCode } from './application-error';

class AuthorizationError extends ApplicationError {
  constructor(
    code: AuthorizationErrorCode,
    message: string = 'You do not have permission to perform this action.',
  ) {
    super(code, message);
  }
}

export { AuthorizationError };
