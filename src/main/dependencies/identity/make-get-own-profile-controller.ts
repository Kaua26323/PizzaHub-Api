import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { PostgresUsersRepository } from '@/infrastructure/database/postgres/repositories/postgres-users-repository';
import { GetOwnProfileUseCase } from '@/application/use-cases/identity/get-own-profile';
import { GetOwnProfileController } from '@/presentation/http/controllers/identity/get-own-profile-controller';

export function makeGetOwnProfileController(): GetOwnProfileController {
  const usersRepository = new PostgresUsersRepository(pool);
  const getOwnProfileUseCase = new GetOwnProfileUseCase(usersRepository);

  return new GetOwnProfileController(getOwnProfileUseCase);
}
