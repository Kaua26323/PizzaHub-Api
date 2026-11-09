import { env } from '@/infrastructure/config/env';
import { makeAccessTokenProvider } from './make-access-token-provider';
import { pool } from '@/infrastructure/database/postgres/connection/pool';

import { SystemClock } from '@/infrastructure/time/system-clock';
import { NodeIdGenerator } from '@/infrastructure/identifiers/node-id-generator';
import { BcryptPasswordHasher } from '@/infrastructure/cryptography/bcrypt-password-hasher';
import { NodeRefreshTokenHasher } from '@/infrastructure/authentication/node-refresh-token-hasher';
import { NodeRefreshTokenGenerator } from '@/infrastructure/authentication/node-refresh-token-generator';
import { PostgresUsersRepository } from '@/infrastructure/database/postgres/repositories/postgres-users-repository';
import { PostgresAuthSessionsRepository } from '@/infrastructure/database/postgres/repositories/postgres-auth-sessions-repository';
import { AuthenticateUserUseCase } from '@/application/use-cases/identity/authenticate-user';
import { AuthenticateUserController } from '@/presentation/http/controllers/identity/authenticate-user-controller';

import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

export function makeAuthenticateUserController(
  jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
): AuthenticateUserController {
  const clock = new SystemClock();
  const idGenerator = new NodeIdGenerator();
  const passwordHasher = new BcryptPasswordHasher(12);
  const usersRepository = new PostgresUsersRepository(pool);
  const refreshTokenHasher = new NodeRefreshTokenHasher();
  const accessTokenProvider = makeAccessTokenProvider();
  const refreshTokenGenerator = new NodeRefreshTokenGenerator();
  const authSessionsRepository = new PostgresAuthSessionsRepository(pool);

  const authenticateUserUseCase = new AuthenticateUserUseCase(
    clock,
    idGenerator,
    passwordHasher,
    usersRepository,
    refreshTokenHasher,
    accessTokenProvider,
    refreshTokenGenerator,
    authSessionsRepository,
    env.REFRESH_TOKEN_TTL_SECONDS,
  );

  return new AuthenticateUserController(
    env.NODE_ENV === 'production',
    env.ACCESS_TOKEN_TTL_SECONDS,
    env.REFRESH_TOKEN_TTL_SECONDS,
    authenticateUserUseCase,
    jsonBodyParserOptions,
  );
}
