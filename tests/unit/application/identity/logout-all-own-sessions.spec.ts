import { describe, expect, it } from 'vitest';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { CreateAuthSessionParams } from '@/application/repositories/auth-sessions-repository';
import { LogoutAllOwnSessionsUseCase } from '@/application/use-cases/identity/logout-all-own-sessions';

import { FakeClock } from '@tests/doubles/services/fake-clock';
import { InMemoryAuthSessionsRepository } from '@tests/doubles/repositories/in-memory-auth-sessions-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const authSessionsRepository = new InMemoryAuthSessionsRepository();

  const clock = new FakeClock(currentDate);

  const sut = new LogoutAllOwnSessionsUseCase(clock, authSessionsRepository);

  return {
    sut,
    clock,
    authSessionsRepository,
  };
}

function makeActor(overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    id: 'user-id',
    role: 'STAFF',
    ...overrides,
  };
}

function makeAuthSession(
  overrides: Partial<CreateAuthSessionParams> = {},
): CreateAuthSessionParams {
  return {
    id: 'current-session-id',
    userId: 'user-id',
    refreshTokenHash: 'hashed:current-refresh-token',
    tokenFamilyId: 'current-token-family-id',
    expiresAt: new Date('2026-01-08T00:00:00.000Z'),
    createdAt: currentDate,
    ipAddress: null,
    userAgent: null,
    ...overrides,
  };
}

describe('LogoutAllOwnSessionsUseCase', () => {
  it('should revoke all sessions owned by the authenticated user', async () => {
    const { sut, authSessionsRepository } = makeSut();

    await authSessionsRepository.create(makeAuthSession());

    await authSessionsRepository.create(
      makeAuthSession({
        id: 'second-session-id',
        refreshTokenHash: 'hashed:second-refresh-token',
        tokenFamilyId: 'second-token-family-id',
      }),
    );

    await sut.execute(makeActor());

    expect(authSessionsRepository.sessions).toEqual([
      {
        ...makeAuthSession(),
        revokedAt: currentDate,
      },
      {
        ...makeAuthSession({
          id: 'second-session-id',
          refreshTokenHash: 'hashed:second-refresh-token',
          tokenFamilyId: 'second-token-family-id',
        }),
        revokedAt: currentDate,
      },
    ]);
  });

  it('should not revoke sessions owned by another user', async () => {
    const { sut, authSessionsRepository } = makeSut();

    await authSessionsRepository.create(makeAuthSession());

    await authSessionsRepository.create(
      makeAuthSession({
        id: 'other-user-session-id',
        userId: 'other-user-id',
        refreshTokenHash: 'hashed:other-user-refresh-token',
        tokenFamilyId: 'other-user-token-family-id',
      }),
    );

    await sut.execute(makeActor());

    expect(authSessionsRepository.sessions).toEqual([
      {
        ...makeAuthSession(),
        revokedAt: currentDate,
      },
      {
        ...makeAuthSession({
          id: 'other-user-session-id',
          userId: 'other-user-id',
          refreshTokenHash: 'hashed:other-user-refresh-token',
          tokenFamilyId: 'other-user-token-family-id',
        }),
        revokedAt: null,
      },
    ]);
  });

  it('should revoke sessions idempotently', async () => {
    const { sut, clock, authSessionsRepository } = makeSut();

    await authSessionsRepository.create(makeAuthSession());

    await sut.execute(makeActor());

    const firstRevokedAt = authSessionsRepository.sessions[0]?.revokedAt;

    clock.set(new Date('2026-01-02T00:00:00.000Z'));

    await sut.execute(makeActor());

    expect(authSessionsRepository.sessions).toHaveLength(1);

    expect(firstRevokedAt).toEqual(currentDate);

    expect(authSessionsRepository.sessions[0]?.revokedAt).toEqual(firstRevokedAt);
  });

  it('should succeed when the authenticated user has no sessions', async () => {
    const { sut, authSessionsRepository } = makeSut();

    await authSessionsRepository.create(
      makeAuthSession({
        id: 'other-user-session-id',
        userId: 'other-user-id',
        refreshTokenHash: 'hashed:other-user-refresh-token',
        tokenFamilyId: 'other-user-token-family-id',
      }),
    );

    await expect(sut.execute(makeActor())).resolves.toBeUndefined();

    expect(authSessionsRepository.sessions).toEqual([
      {
        ...makeAuthSession({
          id: 'other-user-session-id',
          userId: 'other-user-id',
          refreshTokenHash: 'hashed:other-user-refresh-token',
          tokenFamilyId: 'other-user-token-family-id',
        }),
        revokedAt: null,
      },
    ]);
  });
});
