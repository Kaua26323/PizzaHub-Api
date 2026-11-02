import { env } from '@/infrastructure/config/env';
import { Router } from '@/presentation/http/routes/router';
import { sendJson } from '@/presentation/http/responses/send-json';

import { makeAccessTokenProvider } from '@/infrastructure/factories/identity/make-access-token-provider';
import { makeRegisterUserController } from '@/infrastructure/factories/identity/make-register-user-controller';
import { makeAuthenticateUserController } from '@/infrastructure/factories/identity/make-authenticate-user-controller';
import { makeRefreshAuthenticationController } from '@/infrastructure/factories/identity/make-refresh-authentication-controller';
import { makeLogoutCurrentSessionController } from '@/infrastructure/factories/identity/make-logout-current-session-controller';
import { makeLogoutAllOwnSessionsController } from '@/infrastructure/factories/identity/make-logout-all-own-sessions-controller';
import { makeGetOwnProfileController } from '@/infrastructure/factories/identity/make-get-own-profile-controller';
import { makeListUsersController } from '@/infrastructure/factories/identity/make-list-users-controller';
import { makeChangeUserRoleController } from '@/infrastructure/factories/identity/make-change-user-role-controller';

import { makeCreateCategoryController } from '@/infrastructure/factories/categories/make-create-category-controller';
import { makeListCategoriesController } from '@/infrastructure/factories/categories/make-list-categories-controller';
import { makeUpdateCategoryController } from '@/infrastructure/factories/categories/make-update-category-controller';
import { makeDeleteCategoryController } from '@/infrastructure/factories/categories/make-delete-category-controller';
import { makeCreateProductController } from '@/infrastructure/factories/products/make-create-product-controller';
import { makeUpdateProductController } from '@/infrastructure/factories/products/make-update-product-controller';
import { makeListProductsController } from '@/infrastructure/factories/products/make-list-products-controller';

import { GetProductImageController } from '@/presentation/http/controllers/catalog/get-product-image-controller';

import { registerImageRoutes } from '@/presentation/http/routes/image-router';
import { registerIdentityRoutes } from '@/presentation/http/routes/identity-routes';
import { registerCategoriesRoutes } from '@/presentation/http/routes/categories-routes';
import { registerProductRoutes } from '@/presentation/http/routes/product-routes';
import { makeDeleteProductController } from '@/infrastructure/factories/products/make-delete-product-controller';
import { makeChangeProductStatusController } from '@/infrastructure/factories/products/make-change-product-status-controller';

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

  registerImageRoutes(route, {
    allowedRoles: ['STAFF', 'ADMIN'],
    accessTokenProvider: jwtTokenProvider,
    getProductImageController,
  });

  return route;
}
