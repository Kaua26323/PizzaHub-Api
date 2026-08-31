import type { Clock } from '@/application/services/clock';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { AuthSessionsRepository } from '@/application/repositories/auth-sessions-repository';

class LogoutAllOwnSessionsUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly authSessionsRepository: AuthSessionsRepository,
  ) {}

  async execute(actor: AuthenticatedActor): Promise<void> {
    await this.authSessionsRepository.revokeAllByUserId({
      userId: actor.id,
      revokedAt: this.clock.now(),
    });
  }
}

export { LogoutAllOwnSessionsUseCase };
