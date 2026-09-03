import { AuthenticationError } from '@/application/errors/authentication-error';

import type { UsersRepository } from '@/application/repositories/users-repository';
import type { AuthSessionsRepository } from '@/application/repositories/auth-sessions-repository';

import type { Clock } from '@/application/services/clock';
import type { IdGenerator } from '@/application/services/id-generator';
import type { RefreshTokenHasher } from '@/application/services/refresh-token-hasher';
import type { AccessTokenProvider } from '@/application/services/access-token-provider';
import type { RefreshTokenGenerator } from '@/application/services/refresh-token-generator';

function invalidRefreshTokenError(): AuthenticationError {
  return new AuthenticationError('Invalid refresh token.');
}

function assertNever(value: never): never {
  throw new Error(`Unexpected rotation result: ${JSON.stringify(value)}`);
}

export type RefreshAuthenticationResult = {
  accessToken: string;
  refreshToken: string;
};

class RefreshAuthenticationUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    private readonly accessTokenProvider: AccessTokenProvider,
    private readonly refreshTokenGenerator: RefreshTokenGenerator,
    private readonly authSessionsRepository: AuthSessionsRepository,
  ) {}

  async execute(currentRefreshToken: string): Promise<RefreshAuthenticationResult> {
    const currentRefreshTokenHash =
      await this.refreshTokenHasher.hash(currentRefreshToken);

    const currentSession = await this.authSessionsRepository.findByRefreshTokenHash(
      currentRefreshTokenHash,
    );

    if (!currentSession) {
      throw invalidRefreshTokenError();
    }

    const now = this.clock.now();
    const newRefreshToken = await this.refreshTokenGenerator.generate();
    const newRefreshTokenHash = await this.refreshTokenHasher.hash(newRefreshToken);

    const rotationResult = await this.authSessionsRepository.rotate({
      currentRefreshTokenHash,
      revokedAt: now,
      successor: {
        id: this.idGenerator.generate(),
        refreshTokenHash: newRefreshTokenHash,
        createdAt: now,
        ipAddress: null,
        userAgent: null,
      },
    });

    switch (rotationResult.status) {
      case 'rotated':
        break;

      case 'not-found':
      case 'expired':
      case 'revoked':
      case 'reuse-detected':
        throw invalidRefreshTokenError();

      default:
        assertNever(rotationResult);
    }

    const user = await this.usersRepository.findById(currentSession.userId);

    if (!user) {
      throw invalidRefreshTokenError();
    }

    const accessToken = await this.accessTokenProvider.issue({
      userId: user.id,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }
}

export { RefreshAuthenticationUseCase };
