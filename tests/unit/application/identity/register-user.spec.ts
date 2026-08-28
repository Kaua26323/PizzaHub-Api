import { describe, expect, it } from 'vitest';

import { RegisterUserUseCase } from '@/application/use-cases/identity/register-user';
import type { RegisterUserDTO } from '@/application/use-cases/identity/register-user';

import { ConflictError } from '@/application/errors/conflict-error';
import { ValidationError } from '@/application/errors/validation-error';
import { InvalidUserError } from '@/domain/errors/invalid-user-error';
import { InvalidEmailError } from '@/domain/errors/invalid-email-error';

import { FakeClock } from '@tests/doubles/services/fake-clock';
import { FakeIdGenerator } from '@tests/doubles/services/fake-id-generator';
import { FakePasswordHasher } from '@tests/doubles/services/fake-password-hasher';
import { InMemoryUsersRepository } from '@tests/doubles/repositories/in-memory-users-repository';

function makeSut() {
  const usersRepository = new InMemoryUsersRepository();

  const clock = new FakeClock();
  const idGenerator = new FakeIdGenerator();
  const passwordHasher = new FakePasswordHasher();

  const sut = new RegisterUserUseCase(
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

function makeUserDTO(overrides: Partial<RegisterUserDTO> = {}): RegisterUserDTO {
  return {
    name: 'Kauan',
    email: 'example123@gmail.com',
    password: 'super-password-123',
    ...overrides,
  };
}

describe('RegisterUserUseCase', () => {
  it('should register a STAFF user with a hashed password', async () => {
    const { sut, usersRepository, passwordHasher, idGenerator } = makeSut();
    const input = makeUserDTO();

    const result = await sut.execute(input);

    expect(result).toEqual({
      id: 'id-1',
      name: input.name,
      email: input.email,
      role: 'STAFF',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('passwordHash');

    expect(passwordHasher.hashedPasswords).toEqual([input.password]);
    expect(idGenerator.generatedIds).toEqual(['id-1']);

    expect(usersRepository.users).toHaveLength(1);

    const storedUser = usersRepository.users[0];

    expect(storedUser?.role).toBe('STAFF');
    expect(storedUser?.passwordHash).toBe(`hashed:${input.password}`);
    expect(storedUser?.passwordHash).not.toBe(input.password);
  });

  it('should reject a duplicated email without creating another user', async () => {
    const { sut, usersRepository, passwordHasher, idGenerator } = makeSut();

    await sut.execute(makeUserDTO());

    await expect(
      sut.execute(
        makeUserDTO({
          email: ' EXAMPLE123@GMAIL.COM ',
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(usersRepository.users).toHaveLength(1);
    expect(passwordHasher.hashedPasswords).toHaveLength(1);
    expect(idGenerator.generatedIds).toHaveLength(1);
  });

  it('should reject an invalid email without persisting a user', async () => {
    const { sut, usersRepository, passwordHasher } = makeSut();

    await expect(sut.execute(makeUserDTO({ email: 'invalid' }))).rejects.toBeInstanceOf(
      InvalidEmailError,
    );

    expect(usersRepository.users).toHaveLength(0);
    expect(passwordHasher.hashedPasswords).toHaveLength(0);
  });

  it('should reject an invalid name without persisting a user', async () => {
    const { sut, usersRepository } = makeSut();

    await expect(sut.execute(makeUserDTO({ name: '   ' }))).rejects.toBeInstanceOf(
      InvalidUserError,
    );

    expect(usersRepository.users).toHaveLength(0);
  });

  it.each(['', '   '])(
    'should reject an empty password without hashing it',
    async (password) => {
      const { sut, usersRepository, passwordHasher, idGenerator } = makeSut();

      await expect(sut.execute(makeUserDTO({ password }))).rejects.toBeInstanceOf(
        ValidationError,
      );

      expect(passwordHasher.hashedPasswords).toHaveLength(0);
      expect(usersRepository.users).toHaveLength(0);
      expect(idGenerator.generatedIds).toHaveLength(0);
    },
  );
});
