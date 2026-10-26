import type { Router } from './router';
import type { UserRole } from '@/domain/enums/user-role';
import type { AccessTokenProvider } from '@/application/services/access-token-provider';
import type { GetProductImageController } from '@/presentation/http/controllers/catalog/get-product-image-controller';

import { authenticate } from '@/presentation/http/middlewares/authenticate';
import { authorizeRole } from '@/presentation/http/middlewares/authorize-role';
import { composeMiddlewares } from '@/presentation/http/middlewares/compose-middlewares';

export type ImageRoutesDependencies = {
  allowedRoles: UserRole[];
  accessTokenProvider: AccessTokenProvider;
  getProductImageController: GetProductImageController;
};

export function registerImageRoutes(
  route: Router,
  dependencies: ImageRoutesDependencies,
): void {
  const { allowedRoles, accessTokenProvider, getProductImageController } = dependencies;

  route.get(
    '/images/products/:imageKey',
    composeMiddlewares(
      [authenticate(accessTokenProvider), authorizeRole(allowedRoles)],
      getProductImageController.handler,
    ),
  );
}
