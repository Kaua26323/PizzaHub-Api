import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { PostgresUsersRepository } from '@/infrastructure/database/postgres/repositories/postgres-users-repository';
import { ListUsersUseCase } from '@/application/use-cases/identity/list-users';
import { ListUsersController } from '@/presentation/http/controllers/identity/list-users-controller';

export function makeListUsersController(): ListUsersController {
  const usersRepository = new PostgresUsersRepository(pool);
  const listUsersUseCase = new ListUsersUseCase(usersRepository);

  return new ListUsersController(listUsersUseCase);
}
