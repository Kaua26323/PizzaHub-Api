import { env } from '@/infrastructure/config/env';
import { Router } from '@/presentation/http/routes/router';
import { sendJson } from '@/presentation/http/responses/send-json';
import { registerImageRoutes } from '@/presentation/http/routes/image-router';
import { JwtAccessTokenProvider } from '@/infrastructure/authentication/jwt-access-token-provider';
import { GetProductImageController } from '@/presentation/http/controllers/catalog/get-product-image-controller';

const jwtTokenProvider = new JwtAccessTokenProvider({
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
  secret: env.JWT_ACCESS_SECRET,
  ttlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
});

const getProductImageController = new GetProductImageController(env.UPLOAD_DIRECTORY);

export function createApplicationRoutes(): Router {
  const route = new Router();

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

  registerImageRoutes(route, {
    allowedRoles: ['STAFF', 'ADMIN'],
    accessTokenProvider: jwtTokenProvider,
    getProductImageController,
  });

  return route;
}
