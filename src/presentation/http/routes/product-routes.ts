import type { AccessTokenProvider } from '@/application/services/access-token-provider';
import { authenticate } from '@/presentation/http/middlewares/authenticate';
import { authorizeRole } from '@/presentation/http/middlewares/authorize-role';
import { composeMiddlewares } from '@/presentation/http/middlewares/compose-middlewares';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';
import type { Router } from './router';

type Controller = { handler: HttpRequestHandler };

export type ProductRoutesDependencies = {
  accessTokenProvider: AccessTokenProvider;
  listProductsController: Controller;
  createProductController: Controller;
  updateProductController: Controller;
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
}
