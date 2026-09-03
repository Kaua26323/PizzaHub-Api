import { Email } from '@/domain/value-objects/email';
import { AuthenticationError } from '@/application/errors/authentication-error';

import type { Clock } from '@/application/services/clock';
import type { IdGenerator } from '@/application/services/id-generator';
import type { PasswordHasher } from '@/application/services/password-hasher';
import type { UsersRepository } from '@/application/repositories/users-repository';
import type { RefreshTokenHasher } from '@/application/services/refresh-token-hasher';
import type { AccessTokenProvider } from '@/application/services/access-token-provider';
import type { RefreshTokenGenerator } from '@/application/services/refresh-token-generator';
import type { AuthSessionsRepository } from '@/application/repositories/auth-sessions-repository';

export type AuthenticateUserDTO = {
  email: string;
  password: string;
};

export type AuthenticateUserResult = {
  accessToken: string;
  refreshToken: string;
};

class AuthenticateUserUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly passwordHasher: PasswordHasher,
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    private readonly accessTokenProvider: AccessTokenProvider,
    private readonly refreshTokenGenerator: RefreshTokenGenerator,
    private readonly authSessionsRepository: AuthSessionsRepository,
    private readonly refreshTokenTtlSeconds: number,
  ) {}

  async execute(data: AuthenticateUserDTO): Promise<AuthenticateUserResult> {
    const email = new Email(data.email);

    const user = await this.usersRepository.findByEmail(email.value);

    if (!user) {
      throw new AuthenticationError('Email or password is incorrect.');
    }

    const passwordMatches = await this.passwordHasher.compare(
      data.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new AuthenticationError('Email or password is incorrect.');
    }

    const accessToken = await this.accessTokenProvider.issue({
      userId: user.id,
      role: user.role,
    });

    const refreshToken = await this.refreshTokenGenerator.generate();
    const refreshTokenHash = await this.refreshTokenHasher.hash(refreshToken);

    const now = this.clock.now();
    const sessionId = this.idGenerator.generate();

    const expiresAt = new Date(now.getTime() + this.refreshTokenTtlSeconds * 1_000);

    await this.authSessionsRepository.create({
      id: sessionId,
      userId: user.id,
      tokenFamilyId: sessionId,
      refreshTokenHash: refreshTokenHash,

      createdAt: now,
      userAgent: null,
      ipAddress: null,
      expiresAt: expiresAt,
    });

    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
    };
  }
}

export { AuthenticateUserUseCase };
