import { describe, expect, it } from 'vitest';

import { User } from '@/domain/entities/user';

import { AuthenticationError } from '@/application/errors/authentication-error';
import type { CreateAuthSessionParams } from '@/application/repositories/auth-sessions-repository';
import { RefreshAuthenticationUseCase } from '@/application/use-cases/identity/refresh-authentication';

import { InMemoryUsersRepository } from '@tests/doubles/repositories/in-memory-users-repository';
import { InMemoryAuthSessionsRepository } from '@tests/doubles/repositories/in-memory-auth-sessions-repository';

import { FakeClock } from '@tests/doubles/services/fake-clock';
import { FakeIdGenerator } from '@tests/doubles/services/fake-id-generator';
import { FakeRefreshTokenHasher } from '@tests/doubles/services/fake-refresh-token-hasher';
import { FakeAccessTokenProvider } from '@tests/doubles/services/fake-access-token-provider';
import { FakeRefreshTokenGenerator } from '@tests/doubles/services/fake-refresh-token-generator';

const sessionCreatedAt = new Date('2026-01-01T00:00:00.000Z');
const rotationDate = new Date('2026-01-02T00:00:00.000Z');
const originalExpiration = new Date('2026-01-08T00:00:00.000Z');

function makeSut() {
  const usersRepository = new InMemoryUsersRepository();
  const authSessionsRepository = new InMemoryAuthSessionsRepository();

  const clock = new FakeClock(rotationDate);
  const idGenerator = new FakeIdGenerator([
    'successor-session-id',
    'discarded-session-id',
  ]);
  const refreshTokenHasher = new FakeRefreshTokenHasher();
  const accessTokenProvider = new FakeAccessTokenProvider();
  const refreshTokenGenerator = new FakeRefreshTokenGenerator([
    'new-refresh-token',
    'discarded-refresh-token',
  ]);

  const sut = new RefreshAuthenticationUseCase(
    clock,
    idGenerator,
    usersRepository,
    refreshTokenHasher,
    accessTokenProvider,
    refreshTokenGenerator,
    authSessionsRepository,
  );

  return {
    sut,
    clock,
    idGenerator,
    usersRepository,
    refreshTokenHasher,
    accessTokenProvider,
    refreshTokenGenerator,
    authSessionsRepository,
  };
}

function makeUser(): User {
  return new User({
    id: 'user-id',
    name: 'Testing',
    email: 'test123@gmail.com',
    role: 'STAFF',
    passwordHash: 'hashed:strong-password',
    createdAt: sessionCreatedAt,
    updatedAt: sessionCreatedAt,
  });
}

function makeAuthSession(
  overrides: Partial<CreateAuthSessionParams> = {},
): CreateAuthSessionParams {
  return {
    id: 'current-session-id',
    userId: 'user-id',
    refreshTokenHash: 'hashed:current-refresh-token',
    tokenFamilyId: 'token-family-id',
    expiresAt: originalExpiration,
    createdAt: sessionCreatedAt,
    ipAddress: null,
    userAgent: null,
    ...overrides,
  };
}

describe('RefreshAuthenticationUseCase', () => {
  it('should rotate the refresh token and issue a new access token', async () => {
    const {
      sut,
      idGenerator,
      usersRepository,
      refreshTokenHasher,
      accessTokenProvider,
      refreshTokenGenerator,
      authSessionsRepository,
    } = makeSut();

    await usersRepository.create(makeUser());
    await authSessionsRepository.create(makeAuthSession());

    const result = await sut.execute('current-refresh-token');

    expect(result).toEqual({
      accessToken: 'access-token-1',
      refreshToken: 'new-refresh-token',
    });

    expect(refreshTokenHasher.hashedTokens).toEqual([
      'current-refresh-token',
      'new-refresh-token',
    ]);
    expect(refreshTokenGenerator.generatedTokens).toEqual(['new-refresh-token']);
    expect(idGenerator.generatedIds).toEqual(['successor-session-id']);

    expect(accessTokenProvider.issuedTokens).toEqual([
      {
        token: 'access-token-1',
        claims: {
          userId: 'user-id',
          role: 'STAFF',
        },
      },
    ]);

    expect(authSessionsRepository.sessions).toEqual([
      {
        ...makeAuthSession(),
        revokedAt: rotationDate,
      },
      {
        id: 'successor-session-id',
        userId: 'user-id',
        refreshTokenHash: 'hashed:new-refresh-token',
        tokenFamilyId: 'token-family-id',
        expiresAt: originalExpiration,
        revokedAt: null,
        createdAt: rotationDate,
        ipAddress: null,
        userAgent: null,
      },
    ]);

    expect(authSessionsRepository.sessions[1]?.refreshTokenHash).not.toBe(
      result.refreshToken,
    );
  });

  it('should reject an unknown refresh token without creating a session', async () => {
    const {
      sut,
      idGenerator,
      refreshTokenHasher,
      accessTokenProvider,
      refreshTokenGenerator,
      authSessionsRepository,
    } = makeSut();

    const refresh = sut.execute('unknown-refresh-token');

    await expect(refresh).rejects.toBeInstanceOf(AuthenticationError);
    await expect(refresh).rejects.toThrow('Invalid refresh token.');

    expect(refreshTokenHasher.hashedTokens).toEqual(['unknown-refresh-token']);
    expect(refreshTokenGenerator.generatedTokens).toHaveLength(0);
    expect(idGenerator.generatedIds).toHaveLength(0);
    expect(accessTokenProvider.issuedTokens).toHaveLength(0);
    expect(authSessionsRepository.sessions).toHaveLength(0);
  });

  it('should reject an expired session revoked atomically by rotation', async () => {
    const { sut, usersRepository, accessTokenProvider, authSessionsRepository } =
      makeSut();

    await usersRepository.create(makeUser());
    await authSessionsRepository.create(
      makeAuthSession({
        expiresAt: rotationDate,
      }),
    );

    const refresh = sut.execute('current-refresh-token');

    await expect(refresh).rejects.toBeInstanceOf(AuthenticationError);
    await expect(refresh).rejects.toThrow('Invalid refresh token.');

    expect(authSessionsRepository.sessions).toHaveLength(1);
    expect(authSessionsRepository.sessions[0]).toMatchObject({
      id: 'current-session-id',
      revokedAt: rotationDate,
    });
    expect(accessTokenProvider.issuedTokens).toHaveLength(0);
  });

  it('should reject an already revoked refresh session', async () => {
    const { sut, usersRepository, accessTokenProvider, authSessionsRepository } =
      makeSut();
    const revokedAt = new Date('2026-01-01T12:00:00.000Z');

    await usersRepository.create(makeUser());
    await authSessionsRepository.create(makeAuthSession());
    await authSessionsRepository.revokeCurrent({
      refreshTokenHash: 'hashed:current-refresh-token',
      revokedAt,
    });

    const refresh = sut.execute('current-refresh-token');

    await expect(refresh).rejects.toBeInstanceOf(AuthenticationError);
    await expect(refresh).rejects.toThrow('Invalid refresh token.');

    expect(authSessionsRepository.sessions).toHaveLength(1);
    expect(authSessionsRepository.sessions[0]?.revokedAt).toEqual(revokedAt);
    expect(accessTokenProvider.issuedTokens).toHaveLength(0);
  });

  it('should reject reuse after rotation atomically revokes the token family', async () => {
    const { sut, clock, usersRepository, accessTokenProvider, authSessionsRepository } =
      makeSut();
    const reuseDetectedAt = new Date('2026-01-03T00:00:00.000Z');

    await usersRepository.create(makeUser());
    await authSessionsRepository.create(makeAuthSession());

    await sut.execute('current-refresh-token');

    clock.set(reuseDetectedAt);

    const reuseAttempt = sut.execute('current-refresh-token');

    await expect(reuseAttempt).rejects.toBeInstanceOf(AuthenticationError);
    await expect(reuseAttempt).rejects.toThrow('Invalid refresh token.');

    expect(authSessionsRepository.sessions).toHaveLength(2);
    expect(authSessionsRepository.sessions).toEqual([
      {
        ...makeAuthSession(),
        revokedAt: rotationDate,
      },
      {
        id: 'successor-session-id',
        userId: 'user-id',
        refreshTokenHash: 'hashed:new-refresh-token',
        tokenFamilyId: 'token-family-id',
        expiresAt: originalExpiration,
        revokedAt: reuseDetectedAt,
        createdAt: rotationDate,
        ipAddress: null,
        userAgent: null,
      },
    ]);
    expect(accessTokenProvider.issuedTokens).toHaveLength(1);
  });
});
