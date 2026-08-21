export type AuthSession = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  tokenFamilyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
};

export type CreateAuthSessionParams = Omit<AuthSession, 'revokedAt'>;

export type RotateAuthSessionParams = {
  currentRefreshTokenHash: string;
  revokedAt: Date;
  successor: Pick<
    CreateAuthSessionParams,
    'id' | 'refreshTokenHash' | 'createdAt' | 'ipAddress' | 'userAgent'
  >;
};

export type RevokeAuthSessionParams = {
  refreshTokenHash: string;
  revokedAt: Date;
};

export type RevokeUserAuthSessionsParams = {
  userId: string;
  revokedAt: Date;
};

export type RevokeAuthSessionFamilyParams = {
  tokenFamilyId: string;
  revokedAt: Date;
};

export type RotateAuthSessionResult =
  | { status: 'rotated' }
  | { status: 'not-found' }
  | { status: 'expired' }
  | { status: 'revoked' }
  | {
      status: 'reuse-detected';
      tokenFamilyId: string;
    };

export type AuthSessionsRepository = {
  create(session: CreateAuthSessionParams): Promise<void>;
  findByRefreshTokenHash(refreshTokenHash: string): Promise<AuthSession | null>;
  rotate(params: RotateAuthSessionParams): Promise<RotateAuthSessionResult>;
  revokeCurrent(params: RevokeAuthSessionParams): Promise<void>;
  revokeAllByUserId(params: RevokeUserAuthSessionsParams): Promise<void>;
  revokeFamily(params: RevokeAuthSessionFamilyParams): Promise<void>;
};
