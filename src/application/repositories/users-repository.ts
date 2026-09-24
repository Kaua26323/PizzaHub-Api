import type { User } from '@/domain/entities/user';
import type { UserRole } from '@/domain/enums/user-role';

export type ChangeRoleAndRevokeSessionsParams = {
  userId: string;
  role: UserRole;
  revokedAt: Date;
};

export type ChangeRoleAndRevokeSessionsResult =
  { status: 'changed' } | { status: 'not-found' };

export type UsersRepository = {
  create(data: User): Promise<void>;
  listUsers(): Promise<User[]>;
  findById(userId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  changeRoleAndRevokeSessions(
    params: ChangeRoleAndRevokeSessionsParams,
  ): Promise<ChangeRoleAndRevokeSessionsResult>;
};
