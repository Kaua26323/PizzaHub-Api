import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { mapError } from '@/presentation/http/errors/map-error';

import { DomainError } from '@/domain/errors/domain-error';
import { ConflictError } from '@/application/errors/conflict-error';
import { ValidationError } from '@/application/errors/validation-error';
import { ApplicationError } from '@/application/errors/application-error';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { RequestContextError } from '@/presentation/http/request/request-context';
import { JsonBodyParserError } from '@/presentation/http/parsers/json-body-parser';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import { BusboyMultipartParserError } from '@/presentation/http/parsers/busboy-multipart-parse';

// DomainError is abstract; use a small concrete subclass to test its public behavior.
class InvalidDomainValueError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

// Exercise the fallback without relying on a particular ApplicationError constructor.
function unrecognizedApplicationError(): ApplicationError {
  return Object.setPrototypeOf(
    new Error('Internal application details'),
    ApplicationError.prototype,
  ) as ApplicationError;
}

describe('mapError', () => {
  it('should map DomainError to 400 VALIDATION_ERROR', () => {
    expect(mapError(new InvalidDomainValueError('Invalid price.'))).toEqual({
      statusCode: 400,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid price.' },
    });
  });

  it.each([
    [
      'authentication',
      new AuthenticationError('INVALID_CREDENTIALS', 'Invalid credentials.'),
      401,
      'INVALID_CREDENTIALS',
    ],
    [
      'authorization',
      new AuthorizationError('FORBIDDEN', 'Forbidden.'),
      403,
      'FORBIDDEN',
    ],
    [
      'conflict',
      new ConflictError('EMAIL_ALREADY_EXISTS', 'Email already exists.'),
      409,
      'EMAIL_ALREADY_EXISTS',
    ],
    [
      'not found',
      new ResourceNotFoundError('USER_NOT_FOUND', 'User not found.'),
      404,
      'USER_NOT_FOUND',
    ],
    [
      'validation',
      new ValidationError('VALIDATION_ERROR', 'Invalid input.'),
      400,
      'VALIDATION_ERROR',
    ],
  ] as const)('should map %s application errors', (_name, error, statusCode, code) => {
    expect(mapError(error)).toEqual({
      statusCode,
      error: { code, message: error.message },
    });
  });

  it('should conceal an unrecognized ApplicationError', () => {
    expect(mapError(unrecognizedApplicationError())).toEqual({
      statusCode: 500,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    });
  });

  it.each([
    ['MALFORMED_JSON', 400],
    ['VALIDATION_ERROR', 400],
    ['FILE_TOO_LARGE', 413],
    ['UNSUPPORTED_CONTENT_TYPE', 415],
  ] as const)('should map JSON parser error %s to %i', (code, statusCode) => {
    expect(mapError(new JsonBodyParserError(code, `JSON: ${code}`))).toEqual({
      statusCode,
      error: { code, message: `JSON: ${code}` },
    });
  });

  it.each([
    ['INVALID_MULTIPART_BODY', 400],
    ['VALIDATION_ERROR', 400],
    ['FILE_TOO_LARGE', 413],
    ['UNSUPPORTED_IMAGE_TYPE', 415],
    ['UNSUPPORTED_CONTENT_TYPE', 415],
  ] as const)('should map multipart parser error %s to %i', (code, statusCode) => {
    expect(mapError(new BusboyMultipartParserError(code, `Multipart: ${code}`))).toEqual({
      statusCode,
      error: { code, message: `Multipart: ${code}` },
    });
  });

  it.each([
    ['INVALID_QUERY_PARAMETER'],
    ['INVALID_ROUTE_PARAMETER'],
    ['VALIDATION_ERROR'],
  ] as const)('should map request context error %s to 400', (code) => {
    expect(mapError(new RequestContextError(code, 'Invalid URL encoding.'))).toEqual({
      statusCode: 400,
      error: { code, message: 'Invalid URL encoding.' },
    });
  });

  it('should turn Zod issues into API error details', () => {
    const schema = z.object({
      user: z.object({ email: z.email() }),
      quantity: z.number().int().positive(),
    });

    const result = schema.safeParse({ user: { email: 'invalid' }, quantity: -1 });

    expect(result.success).toBe(false);

    if (result.success) throw new Error('Expected Zod validation to fail');

    const mapped = mapError(result.error);

    expect(mapped.statusCode).toBe(400);
    expect(mapped.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
    });
    expect(mapped.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'user.email',
          code: expect.any(String),
          message: expect.any(String),
        }),
        expect.objectContaining({
          path: 'quantity',
          code: expect.any(String),
          message: expect.any(String),
        }),
      ]),
    );
    expect(mapped.error.details).toHaveLength(2);
  });

  it.each([
    new Error('password=secret; DB_HOST=private'),
    'some thrown text',
    null,
    { password: 'secret' },
  ])('should map unknown errors to a sanitized HTTP 500 response', (value) => {
    expect(mapError(value)).toEqual({
      statusCode: 500,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    });
  });
});
