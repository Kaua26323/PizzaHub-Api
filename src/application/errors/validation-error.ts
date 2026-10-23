import { ApplicationError } from './application-error';
import type { ValidationErrorCode } from './application-error';

class ValidationError extends ApplicationError {
  constructor(code: ValidationErrorCode, message: string) {
    super(code, message);
  }
}

export { ValidationError };
