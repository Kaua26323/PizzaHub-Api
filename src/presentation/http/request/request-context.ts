import type { IncomingMessage } from 'node:http';
import type { ApiErrorCode } from '@/presentation/http/responses/api-response';

type RequestContextErrorCode = Extract<
  ApiErrorCode,
  'VALIDATION_ERROR' | 'INVALID_ROUTE_PARAMETER' | 'INVALID_QUERY_PARAMETER'
>;

export class RequestContextError extends Error {
  constructor(
    public readonly code: RequestContextErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RequestContextError';
  }
}

export type ParsedRequestUrl = {
  pathname: string;
  query: URLSearchParams;
};

export type RequestContext = ParsedRequestUrl & {
  params: Readonly<Record<string, string>>;
};

const contexts = new WeakMap<IncomingMessage, RequestContext>();

function decode(value: string, code: RequestContextErrorCode): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new RequestContextError(code, 'Invalid URL encoding.');
  }
}

export function parseRequestUrl(rawUrl: string): ParsedRequestUrl {
  if (
    !rawUrl.startsWith('/') ||
    rawUrl.startsWith('//') ||
    rawUrl.includes('#') ||
    rawUrl.includes('\\') ||
    Array.from(rawUrl).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 32 || codePoint === 127;
    })
  ) {
    throw new RequestContextError('VALIDATION_ERROR', 'Invalid request URL.');
  }

  const queryStart = rawUrl.indexOf('?');
  const rawPathname = queryStart === -1 ? rawUrl : rawUrl.slice(0, queryStart);
  const rawQuery = queryStart === -1 ? undefined : rawUrl.slice(queryStart + 1);

  if (!rawPathname) {
    throw new RequestContextError('VALIDATION_ERROR', 'Invalid request URL.');
  }

  const rawPathnameSegments = rawPathname.split('/');

  for (const segment of rawPathnameSegments) {
    const decoded = decode(segment, 'VALIDATION_ERROR');

    // URL normalizes dot segments, which would change the route being matched.
    if (decoded === '.' || decoded === '..') {
      throw new RequestContextError('VALIDATION_ERROR', 'Invalid request URL.');
    }
  }

  if (rawQuery !== undefined) {
    const rawQuerySegments = rawQuery.split('&');

    for (const pair of rawQuerySegments) {
      const separator = pair.indexOf('=');
      const key = separator === -1 ? pair : pair.slice(0, separator);
      const value = separator === -1 ? '' : pair.slice(separator + 1);

      decode(key.replaceAll('+', ' '), 'INVALID_QUERY_PARAMETER');
      decode(value.replaceAll('+', ' '), 'INVALID_QUERY_PARAMETER');
    }
  }

  try {
    const url = new URL(rawUrl, 'http://localhost');

    return {
      pathname: url.pathname,
      query: url.searchParams,
    };
  } catch {
    throw new RequestContextError('VALIDATION_ERROR', 'Invalid request URL.');
  }
}

export function createRequestContext(
  parsedUrl: ParsedRequestUrl,
  pattern: string,
): RequestContext {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
  const params: Record<string, string> = Object.create(null);

  for (const [index, segment] of patternSegments.entries()) {
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decode(
        pathSegments[index] ?? '',
        'INVALID_ROUTE_PARAMETER',
      );
    }
  }

  return { ...parsedUrl, params };
}

export function setRequestContext(
  request: IncomingMessage,
  context: RequestContext,
): void {
  contexts.set(request, context);
}

export function getRequestContext(request: IncomingMessage): RequestContext {
  const context = contexts.get(request);

  if (!context) {
    throw new Error('Request context has not been set.');
  }

  return context;
}
