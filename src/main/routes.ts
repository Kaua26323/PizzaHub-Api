import { env } from '@/infrastructure/config/env';
import { Router } from '@/presentation/http/routes/router';
import { sendJson } from '@/presentation/http/responses/send-json';

import { SystemClock } from '@/infrastructure/time/system-clock';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { NodeIdGenerator } from '@/infrastructure/identifiers/node-id-generator';
import { BcryptPasswordHasher } from '@/infrastructure/cryptography/bcrypt-password-hasher';
import { JwtAccessTokenProvider } from '@/infrastructure/authentication/jwt-access-token-provider';
import { NodeRefreshTokenHasher } from '@/infrastructure/authentication/node-refresh-token-hasher';
import { NodeRefreshTokenGenerator } from '@/infrastructure/authentication/node-refresh-token-generator';
import { PostgresUsersRepository } from '@/infrastructure/database/postgres/repositories/postgres-users-repository';
import { PostgresAuthSessionsRepository } from '@/infrastructure/database/postgres/repositories/postgres-auth-sessions-repository';

import { ListUsersUseCase } from '@/application/use-cases/identity/list-users';
import { RegisterUserUseCase } from '@/application/use-cases/identity/register-user';
import { GetOwnProfileUseCase } from '@/application/use-cases/identity/get-own-profile';
import { ChangeUserRoleUseCase } from '@/application/use-cases/identity/change-user-role';
import { AuthenticateUserUseCase } from '@/application/use-cases/identity/authenticate-user';
import { LogoutCurrentSessionUseCase } from '@/application/use-cases/identity/logout-current-session';
import { RefreshAuthenticationUseCase } from '@/application/use-cases/identity/refresh-authentication';
import { LogoutAllOwnSessionsUseCase } from '@/application/use-cases/identity/logout-all-own-sessions';

import { ListUsersController } from '@/presentation/http/controllers/identity/list-users-controller';
import { RegisterUserController } from '@/presentation/http/controllers/identity/register-user-controller';
import { GetOwnProfileController } from '@/presentation/http/controllers/identity/get-own-profile-controller';
import { ChangeUserRoleController } from '@/presentation/http/controllers/identity/change-user-role-controller';
import { GetProductImageController } from '@/presentation/http/controllers/catalog/get-product-image-controller';
import { AuthenticateUserController } from '@/presentation/http/controllers/identity/authenticate-user-controller';
import { LogoutCurrentSessionController } from '@/presentation/http/controllers/identity/logout-current-session-controller';
import { LogoutAllOwnSessionController } from '@/presentation/http/controllers/identity/logout-all-own-sessions-controller';
import { RefreshAuthenticationController } from '@/presentation/http/controllers/identity/refresh-authentication-controller';

import { registerImageRoutes } from '@/presentation/http/routes/image-router';
import { registerIdentityRoutes } from '@/presentation/http/routes/identity-routes';

const jwtTokenProvider = new JwtAccessTokenProvider({
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
  secret: env.JWT_ACCESS_SECRET,
  ttlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
});

const clock = new SystemClock();
const idGenerator = new NodeIdGenerator();
const production = env.NODE_ENV === 'production';
const passwordHasher = new BcryptPasswordHasher(12);
const refreshTokenHasher = new NodeRefreshTokenHasher();
const usersRepository = new PostgresUsersRepository(pool);
const refreshTokenGenerator = new NodeRefreshTokenGenerator();
const authSessionsRepository = new PostgresAuthSessionsRepository(pool);
const jsonBodyParserOptions = { maxBytes: 64 * 1024, allowEmpty: false };
const getProductImageController = new GetProductImageController(env.UPLOAD_DIRECTORY);

const registerUserUseCase = new RegisterUserUseCase(
  usersRepository,
  clock,
  idGenerator,
  passwordHasher,
);

const authenticateUserUseCase = new AuthenticateUserUseCase(
  clock,
  idGenerator,
  passwordHasher,
  usersRepository,
  refreshTokenHasher,
  jwtTokenProvider,
  refreshTokenGenerator,
  authSessionsRepository,
  env.REFRESH_TOKEN_TTL_SECONDS,
);

const refreshAuthenticationUseCase = new RefreshAuthenticationUseCase(
  clock,
  idGenerator,
  usersRepository,
  refreshTokenHasher,
  jwtTokenProvider,
  refreshTokenGenerator,
  authSessionsRepository,
);

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

  registerIdentityRoutes(route, {
    accessTokenProvider: jwtTokenProvider,
    registerUserController: new RegisterUserController(
      registerUserUseCase,
      jsonBodyParserOptions,
    ),
    authenticateUserController: new AuthenticateUserController(
      production,
      env.ACCESS_TOKEN_TTL_SECONDS,
      env.REFRESH_TOKEN_TTL_SECONDS,
      authenticateUserUseCase,
      jsonBodyParserOptions,
    ),
    refreshAuthenticationController: new RefreshAuthenticationController(
      production,
      env.ACCESS_TOKEN_TTL_SECONDS,
      refreshAuthenticationUseCase,
    ),
    logoutCurrentSessionController: new LogoutCurrentSessionController(
      production,
      new LogoutCurrentSessionUseCase(clock, refreshTokenHasher, authSessionsRepository),
    ),
    logoutAllOwnSessionsController: new LogoutAllOwnSessionController(
      production,
      new LogoutAllOwnSessionsUseCase(clock, authSessionsRepository),
    ),
    getOwnProfileController: new GetOwnProfileController(
      new GetOwnProfileUseCase(usersRepository),
    ),
    listUsersController: new ListUsersController(new ListUsersUseCase(usersRepository)),
    changeUserRoleController: new ChangeUserRoleController(
      new ChangeUserRoleUseCase(clock, usersRepository),
      jsonBodyParserOptions,
    ),
  });

  registerImageRoutes(route, {
    allowedRoles: ['STAFF', 'ADMIN'],
    accessTokenProvider: jwtTokenProvider,
    getProductImageController,
  });

  return route;
}
