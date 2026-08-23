import type { UserRole } from '@/domain/enums/user-role';

export type AccessTokenClaims = {
  userId: string;
  role: UserRole;
};

export type AccessTokenProvider = {
  issue(claims: AccessTokenClaims): Promise<string>;
  verify(token: string): Promise<AccessTokenClaims>;
};
