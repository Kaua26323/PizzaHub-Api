import { describe, expect, it } from 'vitest';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { GetOwnProfileUseCase } from '@/application/use-cases/identity/get-own-profile';

import { User, type UserProps } from '@/domain/entities/user';

import { InMemoryUsersRepository } from '@tests/doubles/repositories/in-memory-users-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const usersRepository = new InMemoryUsersRepository();
  const sut = new GetOwnProfileUseCase(usersRepository);

  return {
    sut,
    usersRepository,
  };
}

function makeUser(overrides: Partial<UserProps> = {}): User {
  return new User({
    id: 'user-id',
    name: 'Testing',
    email: 'test123@gmail.com',
    role: 'STAFF',
    passwordHash: 'hashed:strong-password',
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

function makeActor(overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    id: 'user-id',
    role: 'STAFF',
    ...overrides,
  };
}

describe('GetOwnProfileUseCase', () => {
  it('should return the authenticated user profile', async () => {
    const { sut, usersRepository } = makeSut();

    await usersRepository.create(
      makeUser({
        id: 'other-user-id',
        email: 'other@gmail.com',
      }),
    );

    const authenticatedUser = makeUser();

    await usersRepository.create(authenticatedUser);

    const result = await sut.execute(makeActor());

    expect(result).toEqual({
      id: authenticatedUser.id,
      name: authenticatedUser.name,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
      createdAt: authenticatedUser.createdAt,
      updatedAt: authenticatedUser.updatedAt,
    });
  });

  it('should never expose password information', async () => {
    const { sut, usersRepository } = makeSut();

    await usersRepository.create(makeUser());

    const result = await sut.execute(makeActor());

    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('should reject an actor whose user does not exist', async () => {
    const { sut } = makeSut();

    const profile = sut.execute(
      makeActor({
        id: 'unknown-user-id',
      }),
    );

    await expect(profile).rejects.toBeInstanceOf(AuthenticationError);

    await expect(profile).rejects.toThrow('Authentication failed.');
  });
});
