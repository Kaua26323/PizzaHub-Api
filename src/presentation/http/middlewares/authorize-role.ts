import type { Middleware } from './compose-middlewares';
import type { UserRole } from '@/domain/enums/user-role';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { AuthenticationError } from '@/application/errors/authentication-error';

export function authorizeRole(allowedRoles: UserRole[]): Middleware {
  return async (request, _response, next) => {
    const { actor } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication is required.',
      );
    }

    if (!allowedRoles.includes(actor.role)) {
      throw new AuthorizationError('FORBIDDEN');
    }

    await next();
  };
}
