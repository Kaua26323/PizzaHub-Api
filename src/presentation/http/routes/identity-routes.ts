import type { Router } from './router';
import type { AccessTokenProvider } from '@/application/services/access-token-provider';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

import { authenticate } from '@/presentation/http/middlewares/authenticate';
import { authorizeRole } from '@/presentation/http/middlewares/authorize-role';
import { composeMiddlewares } from '@/presentation/http/middlewares/compose-middlewares';

type Controller = { handler: HttpRequestHandler };

export type IdentityRoutesDependencies = {
  listUsersController: Controller;
  registerUserController: Controller;
  getOwnProfileController: Controller;
  changeUserRoleController: Controller;
  authenticateUserController: Controller;
  accessTokenProvider: AccessTokenProvider;
  logoutCurrentSessionController: Controller;
  logoutAllOwnSessionsController: Controller;
  refreshAuthenticationController: Controller;
};

export function registerIdentityRoutes(
  router: Router,
  dependencies: IdentityRoutesDependencies,
): void {
  const {
    listUsersController,
    accessTokenProvider,
    registerUserController,
    getOwnProfileController,
    changeUserRoleController,
    authenticateUserController,
    logoutCurrentSessionController,
    logoutAllOwnSessionsController,
    refreshAuthenticationController,
  } = dependencies;

  const requireAuthentication = authenticate(accessTokenProvider);
  const requireAdmin = authorizeRole(['ADMIN']);

  router.post('/auth/register', registerUserController.handler);
  router.post('/auth/login', authenticateUserController.handler);
  router.post('/auth/refresh', refreshAuthenticationController.handler);
  router.post('/auth/logout', logoutCurrentSessionController.handler);

  router.post(
    '/auth/logout-all',
    composeMiddlewares([requireAuthentication], logoutAllOwnSessionsController.handler),
  );

  router.get(
    '/users/me',
    composeMiddlewares([requireAuthentication], getOwnProfileController.handler),
  );

  router.get(
    '/users',
    composeMiddlewares(
      [requireAuthentication, requireAdmin],
      listUsersController.handler,
    ),
  );

  router.patch(
    '/users/:userId/role',
    composeMiddlewares(
      [requireAuthentication, requireAdmin],
      changeUserRoleController.handler,
    ),
  );
}
