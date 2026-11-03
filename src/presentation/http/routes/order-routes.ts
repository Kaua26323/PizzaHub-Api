import type { Router } from './router';
import type { AccessTokenProvider } from '@/application/services/access-token-provider';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

import { authenticate } from '@/presentation/http/middlewares/authenticate';
import { composeMiddlewares } from '@/presentation/http/middlewares/compose-middlewares';

type Controller = { handler: HttpRequestHandler };

export type OrderRoutesDependencies = {
  accessTokenProvider: AccessTokenProvider;
  getOrderController: Controller;
  listOrdersController: Controller;
  createOrderController: Controller;
  submitOrderController: Controller;
  cancelOrderController: Controller;
  addOrderItemController: Controller;
  completeOrderController: Controller;
  updateOrderItemController: Controller;
  removeOrderItemController: Controller;
};

export function registerOrderRoutes(
  router: Router,
  dependencies: OrderRoutesDependencies,
): void {
  const requireAuthentication = authenticate(dependencies.accessTokenProvider);

  router.post(
    '/orders',
    composeMiddlewares(
      [requireAuthentication],
      dependencies.createOrderController.handler,
    ),
  );

  router.get(
    '/orders',
    composeMiddlewares(
      [requireAuthentication],
      dependencies.listOrdersController.handler,
    ),
  );

  router.get(
    '/orders/:orderId',
    composeMiddlewares([requireAuthentication], dependencies.getOrderController.handler),
  );

  router.post(
    '/orders/:orderId/items',
    composeMiddlewares(
      [requireAuthentication],
      dependencies.addOrderItemController.handler,
    ),
  );

  router.patch(
    '/orders/:orderId/items/:itemId',
    composeMiddlewares(
      [requireAuthentication],
      dependencies.updateOrderItemController.handler,
    ),
  );

  router.delete(
    '/orders/:orderId/items/:itemId',
    composeMiddlewares(
      [requireAuthentication],
      dependencies.removeOrderItemController.handler,
    ),
  );

  router.patch(
    '/orders/:orderId/submit',
    composeMiddlewares(
      [requireAuthentication],
      dependencies.submitOrderController.handler,
    ),
  );

  router.patch(
    '/orders/:orderId/complete',
    composeMiddlewares(
      [requireAuthentication],
      dependencies.completeOrderController.handler,
    ),
  );

  router.patch(
    '/orders/:orderId/cancel',
    composeMiddlewares(
      [requireAuthentication],
      dependencies.cancelOrderController.handler,
    ),
  );
}
