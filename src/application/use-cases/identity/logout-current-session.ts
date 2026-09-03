import type { Clock } from '@/application/services/clock';
import type { RefreshTokenHasher } from '@/application/services/refresh-token-hasher';
import type { AuthSessionsRepository } from '@/application/repositories/auth-sessions-repository';

class LogoutCurrentSessionUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    private readonly authSessionsRepository: AuthSessionsRepository,
  ) {}

  async execute(currentRefreshToken: string): Promise<void> {
    const refreshTokenHash = await this.refreshTokenHasher.hash(currentRefreshToken);

    await this.authSessionsRepository.revokeCurrent({
      revokedAt: this.clock.now(),
      refreshTokenHash,
    });
  }
}

export { LogoutCurrentSessionUseCase };
