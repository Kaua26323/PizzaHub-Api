import type { Middleware } from './compose-middlewares';
import { setAuthenticatedActor } from '../request/request-context';
import { AuthenticationError } from '@/application/errors/authentication-error';

import type { AccessTokenProvider } from '@/application/services/access-token-provider';

export function authenticate(accessTokenProvider: AccessTokenProvider): Middleware {
  return async (request, _response, next) => {
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication is required.',
      );
    }

    const match = /^Bearer ([^\s]+)$/i.exec(authorization);

    if (!match) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Invalid authorization header.',
      );
    }

    const token = match[1];

    if (!token) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Invalid authorization header.',
      );
    }

    const claims = await accessTokenProvider.verify(token);

    setAuthenticatedActor(request, { id: claims.userId, role: claims.role });

    return next();
  };
}
