import { describe, expect, it } from 'vitest';

import { User } from '@/domain/entities/user';

import { AuthenticationError } from '@/application/errors/authentication-error';
import { AuthenticateUserUseCase } from '@/application/use-cases/identity/authenticate-user';
import type { AuthenticateUserDTO } from '@/application/use-cases/identity/authenticate-user';

import { FakeClock } from '@tests/doubles/services/fake-clock';
import { FakeIdGenerator } from '@tests/doubles/services/fake-id-generator';
import { FakePasswordHasher } from '@tests/doubles/services/fake-password-hasher';
import { FakeRefreshTokenHasher } from '@tests/doubles/services/fake-refresh-token-hasher';
import { FakeAccessTokenProvider } from '@tests/doubles/services/fake-access-token-provider';
import { FakeRefreshTokenGenerator } from '@tests/doubles/services/fake-refresh-token-generator';

import { InMemoryUsersRepository } from '@tests/doubles/repositories/in-memory-users-repository';
import { InMemoryAuthSessionsRepository } from '@tests/doubles/repositories/in-memory-auth-sessions-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');
const refreshTokenTtlSeconds = 7000;

function makeSut() {
  const usersRepository = new InMemoryUsersRepository();
  const authSessionsRepository = new InMemoryAuthSessionsRepository();

  const clock = new FakeClock(currentDate);
  const idGenerator = new FakeIdGenerator(['session-id']);
  const passwordHasher = new FakePasswordHasher();
  const refreshTokenHasher = new FakeRefreshTokenHasher();
  const accessTokenProvider = new FakeAccessTokenProvider();
  const refreshTokenGenerator = new FakeRefreshTokenGenerator(['refresh-token-value']);

  const sut = new AuthenticateUserUseCase(
    clock,
    idGenerator,
    passwordHasher,
    usersRepository,
    refreshTokenHasher,
    accessTokenProvider,
    refreshTokenGenerator,
    authSessionsRepository,
    refreshTokenTtlSeconds,
  );

  return {
    sut,
    clock,
    idGenerator,
    passwordHasher,
    usersRepository,
    refreshTokenHasher,
    accessTokenProvider,
    refreshTokenGenerator,
    authSessionsRepository,
    refreshTokenTtlSeconds,
  };
}

function makeAuthenticateDTO(
  overrides: Partial<AuthenticateUserDTO> = {},
): AuthenticateUserDTO {
  return {
    email: 'test123@gmail.com',
    password: 'strong-password',
    ...overrides,
  };
}

function makeUser(): User {
  return new User({
    id: 'user-id',
    name: 'Testing',
    email: 'test123@gmail.com',
    role: 'STAFF',
    passwordHash: 'hashed:strong-password',
    createdAt: currentDate,
    updatedAt: currentDate,
  });
}

describe('AuthenticateUserUseCase', () => {
  it('should authenticate a user and create an authentication session', async () => {
    const {
      sut,
      idGenerator,
      passwordHasher,
      usersRepository,
      refreshTokenHasher,
      accessTokenProvider,
      refreshTokenGenerator,
      authSessionsRepository,
    } = makeSut();

    // create an user
    await usersRepository.create(makeUser());
    expect(usersRepository.users).toHaveLength(1);

    const result = await sut.execute(makeAuthenticateDTO());

    expect(result).toEqual({
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-value',
    });

    expect(passwordHasher.comparisons).toEqual([
      {
        password: 'strong-password',
        hash: 'hashed:strong-password',
      },
    ]);

    expect(accessTokenProvider.issuedTokens).toEqual([
      {
        token: 'access-token-1',
        claims: {
          userId: 'user-id',
          role: 'STAFF',
        },
      },
    ]);

    expect(refreshTokenGenerator.generatedTokens).toEqual(['refresh-token-value']);
    expect(refreshTokenHasher.hashedTokens).toEqual(['refresh-token-value']);

    expect(idGenerator.generatedIds).toEqual(['session-id']);

    expect(authSessionsRepository.sessions).toEqual([
      {
        id: 'session-id',
        userId: 'user-id',
        tokenFamilyId: 'session-id',
        refreshTokenHash: 'hashed:refresh-token-value',
        createdAt: currentDate,
        expiresAt: new Date('2026-01-01T01:56:40.000Z'),
        revokedAt: null,
        ipAddress: null,
        userAgent: null,
      },
    ]);

    expect(authSessionsRepository.sessions).toHaveLength(1);
    const storedSession = authSessionsRepository.sessions[0];

    expect(storedSession?.refreshTokenHash).toBe(
      `hashed:${refreshTokenGenerator.generatedTokens[0]}`,
    );
    expect(storedSession?.refreshTokenHash).not.toBe(result.refreshToken);
  });

  it('should reject an unknown email with a non-enumerating error', async () => {
    const {
      sut,
      usersRepository,
      refreshTokenHasher,
      accessTokenProvider,
      refreshTokenGenerator,
      authSessionsRepository,
    } = makeSut();

    await usersRepository.create(makeUser());
    expect(usersRepository.users).toHaveLength(1);

    const authentication = sut.execute(
      makeAuthenticateDTO({
        email: 'unknown@gmail.com',
      }),
    );

    await expect(authentication).rejects.toBeInstanceOf(AuthenticationError);
    await expect(authentication).rejects.toThrow('Email or password is incorrect.');

    expect(accessTokenProvider.issuedTokens).toHaveLength(0);
    expect(refreshTokenGenerator.generatedTokens).toHaveLength(0);
    expect(refreshTokenHasher.hashedTokens).toHaveLength(0);
    expect(authSessionsRepository.sessions).toHaveLength(0);
  });

  it('should reject an incorrect password with the same non-enumerating error', async () => {
    const {
      sut,
      passwordHasher,
      usersRepository,
      refreshTokenHasher,
      accessTokenProvider,
      refreshTokenGenerator,
      authSessionsRepository,
    } = makeSut();

    await usersRepository.create(makeUser());
    expect(usersRepository.users).toHaveLength(1);

    const authentication = sut.execute(
      makeAuthenticateDTO({
        password: 'wrong-password',
      }),
    );

    await expect(authentication).rejects.toBeInstanceOf(AuthenticationError);
    await expect(authentication).rejects.toThrow('Email or password is incorrect.');

    expect(passwordHasher.comparisons).toEqual([
      {
        password: 'wrong-password',
        hash: 'hashed:strong-password',
      },
    ]);

    expect(accessTokenProvider.issuedTokens).toHaveLength(0);
    expect(refreshTokenGenerator.generatedTokens).toHaveLength(0);
    expect(refreshTokenHasher.hashedTokens).toHaveLength(0);
    expect(authSessionsRepository.sessions).toHaveLength(0);
  });
});
