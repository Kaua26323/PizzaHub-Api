type BadRequestErrors =
  | 'VALIDATION_ERROR'
  | 'MALFORMED_JSON'
  | 'INVALID_MULTIPART_BODY'
  | 'INVALID_ROUTE_PARAMETER'
  | 'INVALID_QUERY_PARAMETER'
  | 'PRODUCT_IMAGE_REQUIRED';

type UnauthorizedErrors =
  'AUTHENTICATION_REQUIRED' | 'INVALID_CREDENTIALS' | 'INVALID_REFRESH_TOKEN';

type ForbiddenError = 'FORBIDDEN';

type NotFoundErrors =
  | 'ROUTE_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_ITEM_NOT_FOUND'
  | 'IMAGE_NOT_FOUND';

type ConflictErrors =
  | 'EMAIL_ALREADY_EXISTS'
  | 'CATEGORY_NAME_ALREADY_EXISTS'
  | 'CATEGORY_NOT_EMPTY'
  | 'PRODUCT_HAS_ORDER_HISTORY'
  | 'ORDER_STATE_CONFLICT';

type PayloadError = 'FILE_TOO_LARGE';
type MediaError = 'UNSUPPORTED_IMAGE_TYPE' | 'UNSUPPORTED_CONTENT_TYPE';

type InternalError = 'INTERNAL_ERROR';

export type ApiErrorCode =
  | BadRequestErrors
  | UnauthorizedErrors
  | ForbiddenError
  | NotFoundErrors
  | ConflictErrors
  | PayloadError
  | MediaError
  | InternalError;

export type ApiErrorDetail = {
  path?: string;
  code: string;
  message: string;
};

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetail[];
};

export type ApiErrorResponse = {
  success: false;
  data: null;
  error: ApiError;
};

export type ApiSuccessResponse<TData, TMeta = unknown> = {
  success: true;
  data: TData;
  meta?: TMeta;
  error: null;
};

export type ApiResponse<TData, TMeta = unknown> =
  ApiSuccessResponse<TData, TMeta> | ApiErrorResponse;
