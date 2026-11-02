import type { Router } from './router';
import type { AccessTokenProvider } from '@/application/services/access-token-provider';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

import { authenticate } from '@/presentation/http/middlewares/authenticate';
import { authorizeRole } from '@/presentation/http/middlewares/authorize-role';
import { composeMiddlewares } from '@/presentation/http/middlewares/compose-middlewares';

type Controller = { handler: HttpRequestHandler };

export type ProductRoutesDependencies = {
  accessTokenProvider: AccessTokenProvider;
  listProductsController: Controller;
  createProductController: Controller;
  updateProductController: Controller;
  deleteProductController: Controller;
  changeProductStatusController: Controller;
};

export function registerProductRoutes(
  router: Router,
  dependencies: ProductRoutesDependencies,
): void {
  const requireAuthentication = authenticate(dependencies.accessTokenProvider);
  const requireAdmin = authorizeRole(['ADMIN']);

  router.get(
    '/products',
    composeMiddlewares(
      [requireAuthentication],
      dependencies.listProductsController.handler,
    ),
  );

  router.post(
    '/products',
    composeMiddlewares(
      [requireAuthentication, requireAdmin],
      dependencies.createProductController.handler,
    ),
  );

  router.patch(
    '/products/:productId',
    composeMiddlewares(
      [requireAuthentication, requireAdmin],
      dependencies.updateProductController.handler,
    ),
  );

  router.patch(
    '/products/:productId/status',
    composeMiddlewares(
      [requireAuthentication, requireAdmin],
      dependencies.changeProductStatusController.handler,
    ),
  );

  router.delete(
    '/products/:productId',
    composeMiddlewares(
      [requireAuthentication, requireAdmin],
      dependencies.deleteProductController.handler,
    ),
  );
}
