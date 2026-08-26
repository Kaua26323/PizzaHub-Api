import type { User } from '@/domain/entities/user';
import type { UserRole } from '@/domain/enums/user-role';

export type UpdateUserRoleParams = {
  userId: string;
  role: UserRole;
};

export type UsersRepository = {
  create(data: User): Promise<void>;
  listUsers(): Promise<User[]>;
  findById(userId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  updateRole(params: UpdateUserRoleParams): Promise<void>;
};
