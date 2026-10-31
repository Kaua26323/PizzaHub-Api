import { env } from '@/infrastructure/config/env';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { SystemClock } from '@/infrastructure/time/system-clock';
import { PostgresAuthSessionsRepository } from '@/infrastructure/database/postgres/repositories/postgres-auth-sessions-repository';
import { LogoutAllOwnSessionsUseCase } from '@/application/use-cases/identity/logout-all-own-sessions';
import { LogoutAllOwnSessionController } from '@/presentation/http/controllers/identity/logout-all-own-sessions-controller';

export function makeLogoutAllOwnSessionsController(): LogoutAllOwnSessionController {
  const clock = new SystemClock();
  const authSessionsRepository = new PostgresAuthSessionsRepository(pool);

  const logoutAllOwnSessionsUseCase = new LogoutAllOwnSessionsUseCase(
    clock,
    authSessionsRepository,
  );

  return new LogoutAllOwnSessionController(
    env.NODE_ENV === 'production',
    logoutAllOwnSessionsUseCase,
  );
}
