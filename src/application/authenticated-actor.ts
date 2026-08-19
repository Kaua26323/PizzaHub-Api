import type { UserRole } from '@/domain/enums/user-role';

export type AuthenticatedActor = {
  id: string;
  role: UserRole;
};
