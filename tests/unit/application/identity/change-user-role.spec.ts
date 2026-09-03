import { describe, expect, it } from 'vitest';

import { User } from '@/domain/entities/user';
import type { UserProps } from '@/domain/entities/user';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import { ChangeUserRoleUseCase } from '@/application/use-cases/identity/change-user-role';
import type { CreateAuthSessionParams } from '@/application/repositories/auth-sessions-repository';

import { FakeClock } from '@tests/doubles/services/fake-clock';
import { InMemoryUsersRepository } from '@tests/doubles/repositories/in-memory-users-repository';
import { InMemoryAuthSessionsRepository } from '@tests/doubles/repositories/in-memory-auth-sessions-repository';
import { InMemoryUserRoleChangeRepository } from '@tests/doubles/repositories/in-memory-user-role-change-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const usersRepository = new InMemoryUsersRepository();
  const authSessionsRepository = new InMemoryAuthSessionsRepository();
  const userRoleChangeRepository = new InMemoryUserRoleChangeRepository(
    usersRepository,
    authSessionsRepository,
  );

  const clock = new FakeClock(currentDate);

  const sut = new ChangeUserRoleUseCase(clock, userRoleChangeRepository);

  return {
    sut,
    clock,
    usersRepository,
    authSessionsRepository,
    userRoleChangeRepository,
  };
}

function makeUser(overrides: Partial<UserProps> = {}): User {
  return new User({
    id: 'admin-user-id',
    name: 'Admin',
    email: 'admin123@gmail.com',
    role: 'ADMIN',
    passwordHash: 'hashed:strong-password',
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

function makeAuthSession(
  overrides: Partial<CreateAuthSessionParams> = {},
): CreateAuthSessionParams {
  return {
    id: 'current-session-id',
    userId: 'admin-user-id',
    refreshTokenHash: 'hashed:current-refresh-token',
    tokenFamilyId: 'current-token-family-id',
    expiresAt: new Date('2026-01-08T00:00:00.000Z'),
    createdAt: currentDate,
    ipAddress: null,
    userAgent: null,
    ...overrides,
  };
}

function makeActor(overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    id: 'admin-user-id',
    role: 'ADMIN',
    ...overrides,
  };
}

describe('ChangeUserRoleUseCase', () => {
  it('should allow an ADMIN to change another user role and revoke their sessions', async () => {
    const { sut, usersRepository, authSessionsRepository } = makeSut();

    await usersRepository.create(makeUser());
    await usersRepository.create(
      makeUser({
        id: 'staff-user-id',
        name: 'Staff User',
        email: 'staff@gmail.com',
        role: 'STAFF',
      }),
    );

    await authSessionsRepository.create(makeAuthSession());

    await authSessionsRepository.create(
      makeAuthSession({
        id: 'staff-session-1',
        userId: 'staff-user-id',
        refreshTokenHash: 'hashed:staff-refresh-token-1',
        tokenFamilyId: 'staff-token-family-1',
      }),
    );

    await authSessionsRepository.create(
      makeAuthSession({
        id: 'staff-session-2',
        userId: 'staff-user-id',
        refreshTokenHash: 'hashed:staff-refresh-token-2',
        tokenFamilyId: 'staff-token-family-2',
      }),
    );

    await sut.execute({
      actor: makeActor(),
      targetUserId: 'staff-user-id',
      targetRole: 'ADMIN',
    });

    const updatedUser = usersRepository.users.find((user) => user.id === 'staff-user-id');

    const adminSession = authSessionsRepository.sessions.find(
      (session) => session.id === 'current-session-id',
    );

    const targetSessions = authSessionsRepository.sessions.filter(
      (session) => session.userId === 'staff-user-id',
    );

    expect(updatedUser?.role).toBe('ADMIN');
    expect(adminSession?.revokedAt).toBeNull();

    expect(targetSessions).toHaveLength(2);

    for (const session of targetSessions) {
      expect(session.revokedAt).toEqual(currentDate);
    }
  });

  it('should reject a non-ADMIN actor', async () => {
    const { sut, usersRepository, authSessionsRepository } = makeSut();

    await usersRepository.create(
      makeUser({ id: 'staff-user-id', email: 'staff@gmail.com', role: 'STAFF' }),
    );

    await usersRepository.create(
      makeUser({ id: 'target-user-id', email: 'target@gmail.com', role: 'STAFF' }),
    );

    await authSessionsRepository.create(
      makeAuthSession({ id: 'target-user-id', userId: 'target-user-id' }),
    );

    const execution = sut.execute({
      actor: makeActor({ id: 'staff-user-id', role: 'STAFF' }),
      targetUserId: 'target-user-id',
      targetRole: 'ADMIN',
    });

    await expect(execution).rejects.toThrow(AuthorizationError);

    const targetUser = usersRepository.users.find((user) => user.id === 'target-user-id');

    expect(targetUser?.role).toBe('STAFF');
    expect(authSessionsRepository.sessions[0]?.revokedAt).toBeNull();
  });

  it('should reject an attempt to change the actor own role', async () => {
    const { sut, usersRepository, authSessionsRepository } = makeSut();

    await usersRepository.create(makeUser());
    await authSessionsRepository.create(makeAuthSession());

    const execution = sut.execute({
      actor: makeActor(),
      targetUserId: 'admin-user-id',
      targetRole: 'STAFF',
    });

    await expect(execution).rejects.toThrow(AuthorizationError);

    expect(usersRepository.users[0]?.role).toBe('ADMIN');
    expect(authSessionsRepository.sessions[0]?.revokedAt).toBeNull();
  });

  it('should reject when the target user does not exist', async () => {
    const { sut, usersRepository, authSessionsRepository } = makeSut();

    await usersRepository.create(makeUser());

    const execution = sut.execute({
      actor: makeActor(),
      targetUserId: 'non-existing-user-id',
      targetRole: 'ADMIN',
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);

    expect(usersRepository.users).toHaveLength(1);
    expect(authSessionsRepository.sessions).toHaveLength(0);
  });
});
