import { AuthorizationError } from '@/application/errors/authorization-error';

import type { Middleware } from '@/presentation/http/middlewares/compose-middlewares';

export function requireCsrf(allowedOrigin: string): Middleware {
  return async (request, _response, next) => {
    const origin = request.headers.origin;

    // Reject browser requests from untrusted origins
    if (origin && origin !== allowedOrigin) {
      throw new AuthorizationError('FORBIDDEN');
    }

    // Require the documented custom CSRF header.
    if (request.headers['x-csrf-protection'] !== '1') {
      throw new AuthorizationError('FORBIDDEN');
    }

    await next();
  };
}
