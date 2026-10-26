import { ApplicationError } from './application-error';
import type {
  ApplicationErrorCode,
  AuthenticationErrorCode,
  AuthorizationErrorCode,
} from './application-error';

class AuthenticationError extends ApplicationError {
  constructor(
    code: Extract<ApplicationErrorCode, AuthenticationErrorCode | AuthorizationErrorCode>,
    message: string = 'Authentication failed.',
  ) {
    super(code, message);
  }
}

export { AuthenticationError };
