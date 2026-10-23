import { ZodError } from 'zod';
import type { ApiError } from '../responses/api-response';
import { JsonBodyParserError } from '../parsers/json-body-parser';
import { BusboyMultipartParserError } from '../parsers/busboy-multipart-parse';

import { DomainError } from '@/domain/errors/domain-error';
import { ConflictError } from '@/application/errors/conflict-error';
import { ValidationError } from '@/application/errors/validation-error';
import { ApplicationError } from '@/application/errors/application-error';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import { RequestContextError } from '../request/request-context';

export type MapErrorResult = {
  statusCode: number;
  error: ApiError;
};

export function mapError(error: unknown): MapErrorResult {
  // Map Domain errors
  if (error instanceof DomainError) {
    return {
      statusCode: 400,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
      },
    };
  }

  // Map application errors

  if (error instanceof AuthenticationError) {
    return {
      statusCode: 401,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      statusCode: 403,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof ConflictError) {
    return {
      statusCode: 409,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof ResourceNotFoundError) {
    return {
      statusCode: 404,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof ValidationError) {
    return {
      statusCode: 400,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof ApplicationError) {
    return {
      statusCode: 500,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    };
  }

  // Map parsers errors

  if (error instanceof JsonBodyParserError) {
    let status: number;

    switch (error.code) {
      case 'FILE_TOO_LARGE':
        status = 413;
        break;
      case 'MALFORMED_JSON':
        status = 400;
        break;
      case 'UNSUPPORTED_CONTENT_TYPE':
        status = 415;
        break;
      default:
        status = 400;
    }

    return {
      statusCode: status,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof BusboyMultipartParserError) {
    let status: number;

    switch (error.code) {
      case 'FILE_TOO_LARGE':
        status = 413;
        break;
      case 'INVALID_MULTIPART_BODY':
        status = 400;
        break;
      case 'UNSUPPORTED_IMAGE_TYPE':
      case 'UNSUPPORTED_CONTENT_TYPE':
        status = 415;
        break;
      default:
        status = 400;
    }

    return {
      statusCode: status,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof RequestContextError) {
    return {
      statusCode: 400,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  // map zod errors

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          code: issue.code,
          message: issue.message,
        })),
      },
    };
  }

  return {
    statusCode: 500,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    },
  };
}
