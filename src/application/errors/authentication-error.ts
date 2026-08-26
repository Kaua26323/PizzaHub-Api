import { ApplicationError } from './application-error';

class AuthenticationError extends ApplicationError {
  constructor(message: string = 'Authentication failed.') {
    super(message);
  }
}

export { AuthenticationError };
