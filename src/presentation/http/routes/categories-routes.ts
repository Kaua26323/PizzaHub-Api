import type { Router } from './router';
import type { AccessTokenProvider } from '@/application/services/access-token-provider';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

import { authenticate } from '@/presentation/http/middlewares/authenticate';
import { authorizeRole } from '@/presentation/http/middlewares/authorize-role';
import { composeMiddlewares } from '@/presentation/http/middlewares/compose-middlewares';

type Controller = { handler: HttpRequestHandler };

export type CategoriesRoutesDependencies = {
  createCategoryController: Controller;
  listCategoriesController: Controller;
  updateCategoryController: Controller;
  deleteCategoryController: Controller;
  accessTokenProvider: AccessTokenProvider;
};

export function registerCategoriesRoutes(
  router: Router,
  dependencies: CategoriesRoutesDependencies,
): void {
  const {
    accessTokenProvider,
    createCategoryController,
    listCategoriesController,
    updateCategoryController,
    deleteCategoryController,
  } = dependencies;

  const requireAuthentication = authenticate(accessTokenProvider);
  const requireAdmin = authorizeRole(['ADMIN']);

  router.get(
    '/categories',
    composeMiddlewares([requireAuthentication], listCategoriesController.handler),
  );

  router.post(
    '/categories',
    composeMiddlewares(
      [requireAuthentication, requireAdmin],
      createCategoryController.handler,
    ),
  );

  router.patch(
    '/categories/:categoryId',
    composeMiddlewares(
      [requireAuthentication, requireAdmin],
      updateCategoryController.handler,
    ),
  );

  router.delete(
    '/categories/:categoryId',
    composeMiddlewares(
      [requireAuthentication, requireAdmin],
      deleteCategoryController.handler,
    ),
  );
}
