import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { SystemClock } from '@/infrastructure/time/system-clock';
import { PostgresUsersRepository } from '@/infrastructure/database/postgres/repositories/postgres-users-repository';
import { ChangeUserRoleUseCase } from '@/application/use-cases/identity/change-user-role';
import { ChangeUserRoleController } from '@/presentation/http/controllers/identity/change-user-role-controller';

import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

export function makeChangeUserRoleController(
  jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
): ChangeUserRoleController {
  const clock = new SystemClock();
  const usersRepository = new PostgresUsersRepository(pool);

  const changeUserRoleUseCase = new ChangeUserRoleUseCase(clock, usersRepository);

  return new ChangeUserRoleController(changeUserRoleUseCase, jsonBodyParserOptions);
}
