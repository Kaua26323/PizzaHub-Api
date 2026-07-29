# ADR-005 — HTTP Response Contract

## Status

Accepted

## Context

PizzaHub needs a stable HTTP response contract that is predictable for browser,
mobile, and other API clients.

The contract must clearly distinguish successful responses from error
responses, support TypeScript narrowing, preserve HTTP semantics, and avoid
forcing clients to interpret human-readable messages programmatically.

## Decision

JSON responses use a discriminated union based on the literal `success` field.

### TypeScript contract

```ts
export type ApiResponse<TData, TMeta = unknown> =
  | ApiSuccessResponse<TData, TMeta>
  | ApiErrorResponse;

export interface ApiSuccessResponse<TData, TMeta = unknown> {
  success: true;
  data: TData;
  meta?: TMeta;
  error: null;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: ApiError;
}

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ApiErrorDetail {
  path?: string;
  code: string;
  message: string;
}
```

The `success` property must use the literal types `true` and `false`, not a
generic `boolean`.

This prevents invalid combinations such as:

```text
success: true + error object
success: false + non-null data
```

### Success response

A successful response with a representation uses:

```json
{
  "success": true,
  "data": {
    "id": "product-id",
    "name": "Pepperoni Pizza",
    "price": "45.90"
  },
  "error": null
}
```

Collection responses may include `meta`:

```json
{
  "success": true,
  "data": [
    {
      "id": "product-id",
      "name": "Pepperoni Pizza"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 42,
    "totalPages": 3
  },
  "error": null
}
```

The `meta` property is optional and is included only when the endpoint has
relevant metadata such as pagination.

### Error response

All JSON error responses use:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product was not found."
  }
}
```

Errors with structured details may use:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "body.email",
        "code": "INVALID_FORMAT",
        "message": "Must be a valid email address."
      }
    ]
  }
}
```

### Error fields

`code` is a stable, machine-readable identifier.

Clients must make programmatic decisions using `error.code`, not the exact
`message` text.

`message` is a human-readable explanation.

`details` is optional and is used for field validation, upload constraints, or
other structured information.

The error body does not repeat the HTTP status code. The authoritative status
is the HTTP response status itself.

The initial contract does not include a separate `title` field because `code`
identifies the category and `message` explains the occurrence.

## HTTP status mapping

### 200 OK

Used for successful reads, updates, authentication, refresh, and workflow
actions that return a representation.

### 201 Created

Used when creating users, categories, products, orders, and order items.

### 204 No Content

Used for successful operations that do not return a representation.

A `204` response must not contain a JSON body.

### 400 Bad Request

Used for validation failures, malformed JSON, malformed multipart bodies,
invalid parameters, or missing required upload fields.

Example codes:

```text
VALIDATION_ERROR
MALFORMED_JSON
INVALID_MULTIPART_BODY
INVALID_ROUTE_PARAMETER
INVALID_QUERY_PARAMETER
PRODUCT_IMAGE_REQUIRED
```

### 401 Unauthorized

Used for missing, expired, or invalid authentication credentials.

Example codes:

```text
AUTHENTICATION_REQUIRED
INVALID_CREDENTIALS
INVALID_REFRESH_TOKEN
```

Authentication responses must not reveal whether a specific email exists.

### 403 Forbidden

Used when an authenticated actor lacks permission.

Example code:

```text
FORBIDDEN
```

### 404 Not Found

Used when a route or resource does not exist.

Example codes:

```text
ROUTE_NOT_FOUND
USER_NOT_FOUND
CATEGORY_NOT_FOUND
PRODUCT_NOT_FOUND
ORDER_NOT_FOUND
ORDER_ITEM_NOT_FOUND
IMAGE_NOT_FOUND
```

### 409 Conflict

Used when the request conflicts with persisted state or a uniqueness rule.

Example codes:

```text
EMAIL_ALREADY_EXISTS
CATEGORY_NAME_ALREADY_EXISTS
CATEGORY_NOT_EMPTY
PRODUCT_HAS_ORDER_HISTORY
ORDER_STATE_CONFLICT
```

Concurrency conflicts use the same stable business-state response as other
invalid state transitions. Internal locking details are not exposed.

### 413 Payload Too Large

Used when a body or uploaded file exceeds the configured limit.

Example code:

```text
FILE_TOO_LARGE
```

### 415 Unsupported Media Type

Used when the request content type or uploaded image type is unsupported.

Example code:

```text
UNSUPPORTED_IMAGE_TYPE
```

### 500 Internal Server Error

Used for unexpected failures.

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred."
  }
}
```

## Authentication response example

A successful login or refresh returns the access token inside `data`.

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt...",
    "tokenType": "Bearer",
    "expiresIn": 900
  },
  "error": null
}
```

Browser refresh tokens are transported separately through the configured
HttpOnly cookie and are not included in the JSON body.

## Exceptions

### No-content responses

HTTP `204 No Content` responses do not use the envelope.

### Image delivery

A successful image-delivery request returns binary content with the appropriate
headers.

Errors from image-delivery routes still use the JSON error envelope.

### Multipart endpoints

Multipart endpoints use `multipart/form-data` only for requests.

Their responses continue to use the standard JSON contract.

## Security

Public errors must never expose:

- stack traces;
- SQL statements;
- PostgreSQL internals;
- absolute file-system paths;
- environment variables;
- passwords or password hashes;
- access tokens;
- refresh tokens;
- internal session metadata.

Raw Zod, PostgreSQL, file-system, or library errors must be mapped into stable
Presentation-layer responses.

## Consequences

- TypeScript clients can narrow responses using `response.success`.
- Invalid success/error combinations are prevented at compile time.
- Every JSON response is slightly more verbose.
- HTTP status codes remain authoritative.
- Error codes become part of the public API contract.
