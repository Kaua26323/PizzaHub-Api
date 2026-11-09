import { env } from '@/infrastructure/config/env';
import { pool } from '@/infrastructure/database/postgres/connection/pool';

import { SystemClock } from '@/infrastructure/time/system-clock';
import { NodeRefreshTokenHasher } from '@/infrastructure/authentication/node-refresh-token-hasher';
import { PostgresAuthSessionsRepository } from '@/infrastructure/database/postgres/repositories/postgres-auth-sessions-repository';
import { LogoutCurrentSessionUseCase } from '@/application/use-cases/identity/logout-current-session';
import { LogoutCurrentSessionController } from '@/presentation/http/controllers/identity/logout-current-session-controller';

export function makeLogoutCurrentSessionController(): LogoutCurrentSessionController {
  const clock = new SystemClock();
  const refreshTokenHasher = new NodeRefreshTokenHasher();
  const authSessionsRepository = new PostgresAuthSessionsRepository(pool);

  const logoutCurrentSessionUseCase = new LogoutCurrentSessionUseCase(
    clock,
    refreshTokenHasher,
    authSessionsRepository,
  );

  return new LogoutCurrentSessionController(
    env.NODE_ENV === 'production',
    logoutCurrentSessionUseCase,
  );
}
