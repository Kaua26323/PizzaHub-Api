import { ApplicationError } from './application-error';

class AuthorizationError extends ApplicationError {
  constructor(message: string = 'You do not have permission to perform this action.') {
    super(message);
  }
}

export { AuthorizationError };
