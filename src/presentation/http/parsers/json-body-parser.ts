import { Buffer } from 'node:buffer';
import type { IncomingMessage } from 'node:http';
import type { ApiErrorCode } from '@/presentation/http/responses/api-response';

export type JsonBodyParserOptions = {
  request: IncomingMessage;
  maxBytes: number;
  allowEmpty: boolean;
};

type JsonBodyParserErrorCode = Extract<
  ApiErrorCode,
  'MALFORMED_JSON' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_CONTENT_TYPE' | 'VALIDATION_ERROR'
>;

export class JsonBodyParserError extends Error {
  constructor(
    public readonly code: JsonBodyParserErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'JsonBodyParserError';
  }
}

const SUPPORTED_JSON_MEDIA_TYPES = ['application/json'];

export async function jsonBodyParser({
  request,
  maxBytes,
  allowEmpty,
}: JsonBodyParserOptions): Promise<unknown | undefined> {
  const chunks: Buffer[] = [];

  const contentType = request.headers['content-type'];
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';

  const contentLength = request.headers['content-length'];

  const isValidMediaType = SUPPORTED_JSON_MEDIA_TYPES.includes(mediaType);

  if (contentLength !== undefined && Number(contentLength) > maxBytes) {
    throw new JsonBodyParserError(
      'FILE_TOO_LARGE',
      'JSON body exceeds the maximum allowed size.',
    );
  }

  let receivedBytes = 0;
  let exceededLimit = false;

  try {
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

      receivedBytes += buffer.length;

      if (receivedBytes > maxBytes) {
        exceededLimit = true;
        break;
      }

      if (!isValidMediaType) {
        break;
      }

      chunks.push(buffer);
    }
  } catch (error) {
    if (request.destroyed && !request.complete) {
      throw new JsonBodyParserError('VALIDATION_ERROR', 'Request was aborted');
    }

    throw error;
  }

  if (exceededLimit) {
    throw new JsonBodyParserError(
      'FILE_TOO_LARGE',
      'JSON body exceeds the maximum allowed size.',
    );
  }

  if (receivedBytes === 0) {
    if (allowEmpty) {
      return undefined;
    }

    throw new JsonBodyParserError('VALIDATION_ERROR', 'JSON body can not be empty.');
  }

  if (!isValidMediaType) {
    throw new JsonBodyParserError('UNSUPPORTED_CONTENT_TYPE', 'Invalid content type.');
  }

  const body = Buffer.concat(chunks).toString('utf8');

  try {
    return JSON.parse(body);
  } catch {
    throw new JsonBodyParserError('MALFORMED_JSON', 'Malformed JSON body.');
  }
}
