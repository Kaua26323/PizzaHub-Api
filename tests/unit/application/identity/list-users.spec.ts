import { describe, expect, it } from 'vitest';

import { User } from '@/domain/entities/user';
import type { UserProps } from '@/domain/entities/user';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ListUsersUseCase } from '@/application/use-cases/identity/list-users';

import { InMemoryUsersRepository } from '@tests/doubles/repositories/in-memory-users-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const usersRepository = new InMemoryUsersRepository();
  const sut = new ListUsersUseCase(usersRepository);

  return {
    sut,
    usersRepository,
  };
}

function makeUser(overrides: Partial<UserProps> = {}): User {
  return new User({
    id: 'admin-user-id',
    name: 'Admin User',
    email: 'admin@gmail.com',
    role: 'ADMIN',
    passwordHash: 'hashed:admin-password',
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

function makeActor(overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    id: 'admin-user-id',
    role: 'ADMIN',
    ...overrides,
  };
}

describe('ListUsersUseCase', () => {
  it('should allow an ADMIN to list users', async () => {
    const { sut, usersRepository } = makeSut();

    await usersRepository.create(makeUser());

    await usersRepository.create(
      makeUser({
        id: 'staff-user-id',
        name: 'Staff User',
        email: 'staff@gmail.com',
        role: 'STAFF',
        passwordHash: 'hashed:staff-password',
      }),
    );

    const result = await sut.execute(makeActor());

    expect(result).toEqual([
      {
        id: 'admin-user-id',
        name: 'Admin User',
        email: 'admin@gmail.com',
        role: 'ADMIN',
        createdAt: currentDate,
        updatedAt: currentDate,
      },
      {
        id: 'staff-user-id',
        name: 'Staff User',
        email: 'staff@gmail.com',
        role: 'STAFF',
        createdAt: currentDate,
        updatedAt: currentDate,
      },
    ]);
  });

  it('should never expose password information', async () => {
    const { sut, usersRepository } = makeSut();

    await usersRepository.create(makeUser());

    await usersRepository.create(
      makeUser({
        id: 'staff-user-id',
        name: 'Staff User',
        email: 'staff@gmail.com',
        role: 'STAFF',
      }),
    );

    const result = await sut.execute(makeActor());

    expect(result).toHaveLength(2);

    for (const user of result) {
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('passwordHash');
    }
  });

  it('should reject a non-ADMIN actor', async () => {
    const { sut } = makeSut();

    const listing = sut.execute(
      makeActor({
        role: 'STAFF',
      }),
    );

    await expect(listing).rejects.toBeInstanceOf(AuthorizationError);

    await expect(listing).rejects.toThrow(
      'You do not have permission to perform this action.',
    );
  });
});
