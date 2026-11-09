import { env } from '@/infrastructure/config/env';
import { Router } from '@/presentation/http/routes/router';
import { sendJson } from '@/presentation/http/responses/send-json';

import { makeAccessTokenProvider } from '@/main/dependencies/identity/make-access-token-provider';
import { makeRegisterUserController } from '@/main/dependencies/identity/make-register-user-controller';
import { makeAuthenticateUserController } from '@/main/dependencies/identity/make-authenticate-user-controller';
import { makeRefreshAuthenticationController } from '@/main/dependencies/identity/make-refresh-authentication-controller';
import { makeLogoutCurrentSessionController } from '@/main/dependencies/identity/make-logout-current-session-controller';
import { makeLogoutAllOwnSessionsController } from '@/main/dependencies/identity/make-logout-all-own-sessions-controller';
import { makeGetOwnProfileController } from '@/main/dependencies/identity/make-get-own-profile-controller';
import { makeListUsersController } from '@/main/dependencies/identity/make-list-users-controller';
import { makeChangeUserRoleController } from '@/main/dependencies/identity/make-change-user-role-controller';

import { makeCreateCategoryController } from '@/main/dependencies/categories/make-create-category-controller';
import { makeListCategoriesController } from '@/main/dependencies/categories/make-list-categories-controller';
import { makeUpdateCategoryController } from '@/main/dependencies/categories/make-update-category-controller';
import { makeDeleteCategoryController } from '@/main/dependencies/categories/make-delete-category-controller';
import { makeCreateProductController } from '@/main/dependencies/products/make-create-product-controller';
import { makeUpdateProductController } from '@/main/dependencies/products/make-update-product-controller';
import { makeListProductsController } from '@/main/dependencies/products/make-list-products-controller';
import { makeCreateOrderController } from '@/main/dependencies/orders/make-create-order-controller';
import { makeListOrdersController } from '@/main/dependencies/orders/make-list-orders-controller';
import { makeGetOrderController } from '@/main/dependencies/orders/make-get-order-controller';
import { makeAddOrderItemController } from '@/main/dependencies/orders/make-add-order-item-controller';
import { makeUpdateOrderItemController } from '@/main/dependencies/orders/make-update-order-item-controller';
import { makeRemoveOrderItemController } from '@/main/dependencies/orders/make-remove-order-item-controller';
import { makeSubmitOrderController } from '@/main/dependencies/orders/make-submit-order-controller';
import { makeCompleteOrderController } from '@/main/dependencies/orders/make-complete-order-controller';
import { makeCancelOrderController } from '@/main/dependencies/orders/make-cancel-order-controller';

import { GetProductImageController } from '@/presentation/http/controllers/catalog/get-product-image-controller';

import { registerImageRoutes } from '@/presentation/http/routes/image-router';
import { registerIdentityRoutes } from '@/presentation/http/routes/identity-routes';
import { registerCategoriesRoutes } from '@/presentation/http/routes/categories-routes';
import { registerProductRoutes } from '@/presentation/http/routes/product-routes';
import { registerOrderRoutes } from '@/presentation/http/routes/order-routes';
import { makeDeleteProductController } from '@/main/dependencies/products/make-delete-product-controller';
import { makeChangeProductStatusController } from '@/main/dependencies/products/make-change-product-status-controller';

const jsonBodyParserOptions = { maxBytes: 64 * 1024, allowEmpty: false };
const productMultipartOptions = {
  temporaryFilePath: env.UPLOAD_TEMP_DIRECTORY,
  maxFileSize: env.MAX_UPLOAD_SIZE,
  maxTotalBytes: env.MAX_UPLOAD_SIZE + 128 * 1024,
};
const getProductImageController = new GetProductImageController(env.UPLOAD_DIRECTORY);

export function createApplicationRoutes(): Router {
  const route = new Router();
  const jwtTokenProvider = makeAccessTokenProvider();

  route.get('/health', async (_request, response) => {
    sendJson({
      response,
      statusCode: 200,
      body: {
        success: true,
        data: {
          status: 'ok',
        },
        error: null,
      },
    });

    return;
  });

  registerIdentityRoutes(route, {
    allowedOrigins: env.WEB_ORIGIN,
    accessTokenProvider: jwtTokenProvider,
    registerUserController: makeRegisterUserController(jsonBodyParserOptions),
    authenticateUserController: makeAuthenticateUserController(jsonBodyParserOptions),
    refreshAuthenticationController: makeRefreshAuthenticationController(),
    logoutCurrentSessionController: makeLogoutCurrentSessionController(),
    logoutAllOwnSessionsController: makeLogoutAllOwnSessionsController(),
    getOwnProfileController: makeGetOwnProfileController(),
    listUsersController: makeListUsersController(),
    changeUserRoleController: makeChangeUserRoleController(jsonBodyParserOptions),
  });

  registerCategoriesRoutes(route, {
    accessTokenProvider: jwtTokenProvider,
    listCategoriesController: makeListCategoriesController(),
    deleteCategoryController: makeDeleteCategoryController(),
    createCategoryController: makeCreateCategoryController(jsonBodyParserOptions),
    updateCategoryController: makeUpdateCategoryController(jsonBodyParserOptions),
  });

  registerProductRoutes(route, {
    accessTokenProvider: jwtTokenProvider,
    listProductsController: makeListProductsController(),
    createProductController: makeCreateProductController(
      productMultipartOptions,
      env.UPLOAD_DIRECTORY,
    ),
    updateProductController: makeUpdateProductController(
      productMultipartOptions,
      env.UPLOAD_DIRECTORY,
    ),
    deleteProductController: makeDeleteProductController(
      env.UPLOAD_TEMP_DIRECTORY,
      env.UPLOAD_DIRECTORY,
    ),
    changeProductStatusController:
      makeChangeProductStatusController(jsonBodyParserOptions),
  });

  registerOrderRoutes(route, {
    accessTokenProvider: jwtTokenProvider,
    createOrderController: makeCreateOrderController(jsonBodyParserOptions),
    listOrdersController: makeListOrdersController(),
    getOrderController: makeGetOrderController(),
    addOrderItemController: makeAddOrderItemController(jsonBodyParserOptions),
    updateOrderItemController: makeUpdateOrderItemController(jsonBodyParserOptions),
    removeOrderItemController: makeRemoveOrderItemController(),
    submitOrderController: makeSubmitOrderController(),
    completeOrderController: makeCompleteOrderController(),
    cancelOrderController: makeCancelOrderController(),
  });

  registerImageRoutes(route, {
    allowedRoles: ['STAFF', 'ADMIN'],
    accessTokenProvider: jwtTokenProvider,
    getProductImageController,
  });

  return route;
}
