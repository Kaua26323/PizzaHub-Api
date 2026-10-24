export type ValidationErrorCode = 'VALIDATION_ERROR';

export type AuthorizationErrorCode = 'FORBIDDEN';

export type AuthenticationErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN'
  | 'INVALID_ACCESS_TOKEN'
  | 'ACCESS_TOKEN_EXPIRED';

export type NotFoundErrorCode =
  | 'USER_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_ITEM_NOT_FOUND';

export type ConflictErrorCode =
  | 'EMAIL_ALREADY_EXISTS'
  | 'CATEGORY_NAME_ALREADY_EXISTS'
  | 'CATEGORY_NOT_EMPTY'
  | 'PRODUCT_HAS_ORDER_HISTORY'
  | 'ORDER_STATE_CONFLICT';

export type ApplicationErrorCode =
  | ValidationErrorCode
  | AuthorizationErrorCode
  | AuthenticationErrorCode
  | NotFoundErrorCode
  | ConflictErrorCode;

abstract class ApplicationError extends Error {
  public readonly code: ApplicationErrorCode;

  protected constructor(
    code: ApplicationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);

    this.name = new.target.name;
    this.code = code;
  }
}

export { ApplicationError };
