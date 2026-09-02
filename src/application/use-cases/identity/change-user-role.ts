import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import type { UserRole } from '@/domain/enums/user-role';
import type { Clock } from '@/application/services/clock';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { UserRoleChangeRepository } from '@/application/repositories/user-role-change-repository';

export type ChangeUserRoleDTO = {
  actor: AuthenticatedActor;
  targetUserId: string;
  targetRole: UserRole;
};

class ChangeUserRoleUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly userRoleChangeRepository: UserRoleChangeRepository,
  ) {}

  async execute(data: ChangeUserRoleDTO): Promise<void> {
    const { actor, targetUserId, targetRole } = data;

    if (actor.role !== 'ADMIN') {
      throw new AuthorizationError();
    }

    if (actor.id === targetUserId) {
      throw new AuthorizationError();
    }

    const result = await this.userRoleChangeRepository.changeRoleAndRevokeSessions({
      userId: targetUserId,
      role: targetRole,
      revokedAt: this.clock.now(),
    });

    if (result.status === 'not-found') {
      throw new ResourceNotFoundError();
    }
  }
}

export { ChangeUserRoleUseCase };
