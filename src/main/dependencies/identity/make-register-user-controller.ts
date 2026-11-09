import { pool } from '@/infrastructure/database/postgres/connection/pool';

import { SystemClock } from '@/infrastructure/time/system-clock';
import { NodeIdGenerator } from '@/infrastructure/identifiers/node-id-generator';
import { BcryptPasswordHasher } from '@/infrastructure/cryptography/bcrypt-password-hasher';
import { PostgresUsersRepository } from '@/infrastructure/database/postgres/repositories/postgres-users-repository';
import { RegisterUserUseCase } from '@/application/use-cases/identity/register-user';
import { RegisterUserController } from '@/presentation/http/controllers/identity/register-user-controller';

import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

export function makeRegisterUserController(
  jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
): RegisterUserController {
  const usersRepository = new PostgresUsersRepository(pool);

  const clock = new SystemClock();
  const idGenerator = new NodeIdGenerator();
  const passwordHasher = new BcryptPasswordHasher(12);

  const registerUserUseCase = new RegisterUserUseCase(
    usersRepository,
    clock,
    idGenerator,
    passwordHasher,
  );

  return new RegisterUserController(registerUserUseCase, jsonBodyParserOptions);
}
