import { describe, expect, it } from 'vitest';

import type { CreateAuthSessionParams } from '@/application/repositories/auth-sessions-repository';
import { LogoutCurrentSessionUseCase } from '@/application/use-cases/identity/logout-current-session';

import { FakeClock } from '@tests/doubles/services/fake-clock';
import { FakeRefreshTokenHasher } from '@tests/doubles/services/fake-refresh-token-hasher';
import { InMemoryAuthSessionsRepository } from '@tests/doubles/repositories/in-memory-auth-sessions-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const authSessionsRepository = new InMemoryAuthSessionsRepository();

  const clock = new FakeClock(currentDate);
  const refreshTokenHasher = new FakeRefreshTokenHasher();

  const sut = new LogoutCurrentSessionUseCase(
    clock,
    refreshTokenHasher,
    authSessionsRepository,
  );

  return {
    sut,
    clock,
    refreshTokenHasher,
    authSessionsRepository,
  };
}

function makeAuthSession(
  overrides: Partial<CreateAuthSessionParams> = {},
): CreateAuthSessionParams {
  return {
    id: 'current-session-id',
    userId: 'user-id',
    refreshTokenHash: 'hashed:current-refresh-token',
    tokenFamilyId: 'token-family-id',
    expiresAt: new Date('2026-01-08T00:00:00.000Z'),
    createdAt: currentDate,
    ipAddress: null,
    userAgent: null,
    ...overrides,
  };
}

describe('LogoutCurrentSessionUseCase', () => {
  it('should revoke the current refresh session', async () => {
    const { sut, refreshTokenHasher, authSessionsRepository } = makeSut();

    await authSessionsRepository.create(makeAuthSession());

    await expect(sut.execute('current-refresh-token')).resolves.toBeUndefined();

    expect(refreshTokenHasher.hashedTokens).toEqual(['current-refresh-token']);

    expect(authSessionsRepository.sessions).toEqual([
      {
        ...makeAuthSession(),
        revokedAt: currentDate,
      },
    ]);
  });

  it('should revoke the current session idempotently', async () => {
    const { sut, clock, refreshTokenHasher, authSessionsRepository } = makeSut();

    await authSessionsRepository.create(makeAuthSession());

    await sut.execute('current-refresh-token');

    const firstRevokedAt = authSessionsRepository.sessions[0]?.revokedAt;

    clock.set(new Date('2026-01-02T00:00:00.000Z'));

    await expect(sut.execute('current-refresh-token')).resolves.toBeUndefined();

    expect(authSessionsRepository.sessions).toHaveLength(1);

    expect(firstRevokedAt).toEqual(currentDate);

    expect(authSessionsRepository.sessions[0]?.revokedAt).toEqual(firstRevokedAt);

    expect(refreshTokenHasher.hashedTokens).toEqual([
      'current-refresh-token',
      'current-refresh-token',
    ]);
  });

  it('should succeed when the refresh session does not exist', async () => {
    const { sut, refreshTokenHasher, authSessionsRepository } = makeSut();

    await expect(sut.execute('unknown-refresh-token')).resolves.toBeUndefined();

    expect(refreshTokenHasher.hashedTokens).toEqual(['unknown-refresh-token']);

    expect(authSessionsRepository.sessions).toHaveLength(0);
  });

  it('should revoke only the session represented by the refresh token', async () => {
    const { sut, authSessionsRepository } = makeSut();

    await authSessionsRepository.create(makeAuthSession());

    await authSessionsRepository.create(
      makeAuthSession({
        id: 'other-session-id',
        refreshTokenHash: 'hashed:other-refresh-token',
        tokenFamilyId: 'other-token-family-id',
      }),
    );

    await sut.execute('current-refresh-token');

    expect(authSessionsRepository.sessions).toEqual([
      {
        ...makeAuthSession(),
        revokedAt: currentDate,
      },
      {
        ...makeAuthSession({
          id: 'other-session-id',
          refreshTokenHash: 'hashed:other-refresh-token',
          tokenFamilyId: 'other-token-family-id',
        }),
        revokedAt: null,
      },
    ]);
  });
});
