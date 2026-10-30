import type { IncomingMessage, ServerResponse } from 'node:http';

const allowedMethods = new Set(['GET', 'POST', 'PATCH', 'DELETE']);
const allowedHeaders = new Set(['authorization', 'content-type', 'x-csrf-protection']);

export function browserSecurity(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigin: string,
): boolean {
  const origin = request.headers.origin;

  // Requests without Origin may come from native clients.
  // Authentication and authorization remain mandatory.
  if (!origin) {
    return false;
  }

  // An untrusted origin receives no CORS permissions.
  if (origin !== allowedOrigin) {
    if (request.method === 'OPTIONS') {
      response.statusCode = 403;
      response.end();

      return true;
    }

    return false;
  }

  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');

  if (request.method !== 'OPTIONS') {
    return false;
  }

  const requestedMethod = request.headers['access-control-request-method']?.toUpperCase();

  if (!requestedMethod || !allowedMethods.has(requestedMethod)) {
    response.statusCode = 403;
    response.end();
    return true;
  }

  const requestedHeaders = (request.headers['access-control-request-headers'] ?? '')
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);

  if (requestedHeaders.some((header) => !allowedHeaders.has(header))) {
    response.statusCode = 403;
    response.end();
    return true;
  }

  response.setHeader('Access-Control-Allow-Methods', [...allowedMethods].join(', '));
  response.setHeader('Access-Control-Allow-Headers', [...allowedHeaders].join(', '));

  response.statusCode = 204;
  response.end();

  return true;
}
