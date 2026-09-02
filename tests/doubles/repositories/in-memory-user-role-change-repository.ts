import type {
  ChangeRoleAndRevokeSessionsParams,
  ChangeRoleAndRevokeSessionsResult,
  UserRoleChangeRepository,
} from '@/application/repositories/user-role-change-repository';

import type { InMemoryAuthSessionsRepository } from './in-memory-auth-sessions-repository';
import type { InMemoryUsersRepository } from './in-memory-users-repository';

class InMemoryUserRoleChangeRepository implements UserRoleChangeRepository {
  constructor(
    private readonly usersRepository: InMemoryUsersRepository,
    private readonly authSessionsRepository: InMemoryAuthSessionsRepository,
  ) {}

  async changeRoleAndRevokeSessions(
    params: ChangeRoleAndRevokeSessionsParams,
  ): Promise<ChangeRoleAndRevokeSessionsResult> {
    const user = this.usersRepository.users.find((item) => item.id === params.userId);

    if (!user) return { status: 'not-found' };

    user.changeRole(params.role);

    await this.authSessionsRepository.revokeAllByUserId({
      userId: params.userId,
      revokedAt: params.revokedAt,
    });

    return { status: 'changed' };
  }
}

export { InMemoryUserRoleChangeRepository };
