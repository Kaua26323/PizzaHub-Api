import type { User } from '@/domain/entities/user';
import type { UserRole } from '@/domain/enums/user-role';

export type ChangeRoleAndRevokeSessionsParams = {
  userId: string;
  role: UserRole;
  revokedAt: Date;
};

export type ChangeRoleAndRevokeSessionsResult =
  { status: 'changed' } | { status: 'not-found' };

export type CreateInitialAdminResult =
  { status: 'created' } | { status: 'admin-already-exists' };

export type UsersRepository = {
  create(data: User): Promise<void>;
  listUsers(): Promise<User[]>;
  findById(userId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  createInitialAdmin(data: User): Promise<CreateInitialAdminResult>;
  changeRoleAndRevokeSessions(
    params: ChangeRoleAndRevokeSessionsParams,
  ): Promise<ChangeRoleAndRevokeSessionsResult>;
};
