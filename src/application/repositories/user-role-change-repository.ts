import type { UserRole } from '@/domain/enums/user-role';

export type ChangeRoleAndRevokeSessionsParams = {
  userId: string;
  role: UserRole;
  revokedAt: Date;
};

export type ChangeRoleAndRevokeSessionsResult =
  { status: 'changed' } | { status: 'not-found' };

export type UserRoleChangeRepository = {
  changeRoleAndRevokeSessions(
    params: ChangeRoleAndRevokeSessionsParams,
  ): Promise<ChangeRoleAndRevokeSessionsResult>;
};
