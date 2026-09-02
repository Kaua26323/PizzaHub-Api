import { describe, expect, it } from 'vitest';

import { InvalidUserError } from '@/domain/errors/invalid-user-error';
import { InvalidEmailError } from '@/domain/errors/invalid-email-error';

import { ConflictError } from '@/application/errors/conflict-error';
import { ValidationError } from '@/application/errors/validation-error';
import { BootstrapAdminUseCase } from '@/application/use-cases/identity/bootstrap-admin';
import type { BootstrapAdminDTO } from '@/application/use-cases/identity/bootstrap-admin';

import { FakeClock } from '@tests/doubles/services/fake-clock';
import { FakeIdGenerator } from '@tests/doubles/services/fake-id-generator';
import { FakePasswordHasher } from '@tests/doubles/services/fake-password-hasher';
import { InMemoryUsersRepository } from '@tests/doubles/repositories/in-memory-users-repository';

function makeBootstrapAdminDTO(
  overrides: Partial<BootstrapAdminDTO> = {},
): BootstrapAdminDTO {
  return {
    name: 'Initial Admin',
    email: 'admin@example.com',
    password: 'admin-password-from-input',
    ...overrides,
  };
}

function makeSut() {
  const usersRepository = new InMemoryUsersRepository();

  const clock = new FakeClock();
  const idGenerator = new FakeIdGenerator();
  const passwordHasher = new FakePasswordHasher();

  const sut = new BootstrapAdminUseCase(
    usersRepository,
    clock,
    idGenerator,
    passwordHasher,
  );

  return {
    sut,
    clock,
    idGenerator,
    passwordHasher,
    usersRepository,
  };
}

describe('BootstrapAdminUseCase', () => {
  it('creates an ADMIN using the explicitly provided credentials', async () => {
    const { sut, usersRepository, clock, idGenerator, passwordHasher } = makeSut();
    const data = makeBootstrapAdminDTO();

    await expect(sut.execute(data)).resolves.toBeUndefined();

    expect(passwordHasher.hashedPasswords).toEqual([data.password]);
    expect(idGenerator.generatedIds).toEqual(['id-1']);
    expect(usersRepository.users).toHaveLength(1);
    expect(usersRepository.users[0]).toMatchObject({
      id: 'id-1',
      name: data.name,
      email: data.email,
      role: 'ADMIN',
      passwordHash: `hashed:${data.password}`,
      createdAt: clock.now(),
      updatedAt: clock.now(),
    });
  });

  it('rejects an email that is already registered', async () => {
    const { sut, usersRepository, idGenerator, passwordHasher } = makeSut();
    const data = makeBootstrapAdminDTO();

    await sut.execute(data);

    await expect(
      sut.execute(
        makeBootstrapAdminDTO({
          name: 'Another Admin',
          email: '  ADMIN@EXAMPLE.COM  ',
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(usersRepository.users).toHaveLength(1);
    expect(passwordHasher.hashedPasswords).toEqual([data.password]);
    expect(idGenerator.generatedIds).toEqual(['id-1']);
  });

  it('rejects an invalid email without hashing or persisting the password', async () => {
    const { sut, usersRepository, idGenerator, passwordHasher } = makeSut();

    await expect(
      sut.execute(makeBootstrapAdminDTO({ email: 'invalid-email' })),
    ).rejects.toBeInstanceOf(InvalidEmailError);

    expect(usersRepository.users).toHaveLength(0);
    expect(passwordHasher.hashedPasswords).toHaveLength(0);
    expect(idGenerator.generatedIds).toHaveLength(0);
  });

  it('rejects an invalid name without persisting an admin', async () => {
    const { sut, usersRepository } = makeSut();

    await expect(
      sut.execute(makeBootstrapAdminDTO({ name: '   ' })),
    ).rejects.toBeInstanceOf(InvalidUserError);

    expect(usersRepository.users).toHaveLength(0);
  });

  it.each(['', '   '])(
    'rejects an empty password (%j) without hashing or persisting it',
    async (password) => {
      const { sut, usersRepository, idGenerator, passwordHasher } = makeSut();

      await expect(
        sut.execute(makeBootstrapAdminDTO({ password })),
      ).rejects.toBeInstanceOf(ValidationError);

      expect(usersRepository.users).toHaveLength(0);
      expect(passwordHasher.hashedPasswords).toHaveLength(0);
      expect(idGenerator.generatedIds).toHaveLength(0);
    },
  );
});
