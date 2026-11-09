import { env } from '@/infrastructure/config/env';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { SystemClock } from '@/infrastructure/time/system-clock';
import { NodeIdGenerator } from '@/infrastructure/identifiers/node-id-generator';
import { NodeRefreshTokenHasher } from '@/infrastructure/authentication/node-refresh-token-hasher';
import { NodeRefreshTokenGenerator } from '@/infrastructure/authentication/node-refresh-token-generator';
import { PostgresUsersRepository } from '@/infrastructure/database/postgres/repositories/postgres-users-repository';
import { PostgresAuthSessionsRepository } from '@/infrastructure/database/postgres/repositories/postgres-auth-sessions-repository';
import { RefreshAuthenticationUseCase } from '@/application/use-cases/identity/refresh-authentication';
import { RefreshAuthenticationController } from '@/presentation/http/controllers/identity/refresh-authentication-controller';
import { makeAccessTokenProvider } from './make-access-token-provider';

export function makeRefreshAuthenticationController(): RefreshAuthenticationController {
  const clock = new SystemClock();
  const idGenerator = new NodeIdGenerator();
  const usersRepository = new PostgresUsersRepository(pool);
  const refreshTokenHasher = new NodeRefreshTokenHasher();
  const accessTokenProvider = makeAccessTokenProvider();
  const refreshTokenGenerator = new NodeRefreshTokenGenerator();
  const authSessionsRepository = new PostgresAuthSessionsRepository(pool);

  const refreshAuthenticationUseCase = new RefreshAuthenticationUseCase(
    clock,
    idGenerator,
    usersRepository,
    refreshTokenHasher,
    accessTokenProvider,
    refreshTokenGenerator,
    authSessionsRepository,
  );

  return new RefreshAuthenticationController(
    env.NODE_ENV === 'production',
    env.ACCESS_TOKEN_TTL_SECONDS,
    refreshAuthenticationUseCase,
  );
}
