import type {
  AuthSession,
  AuthSessionsRepository,
  CreateAuthSessionParams,
  RevokeAuthSessionFamilyParams,
  RevokeAuthSessionParams,
  RevokeUserAuthSessionsParams,
  RotateAuthSessionParams,
  RotateAuthSessionResult,
} from '@/application/repositories/auth-sessions-repository';

function cloneSession(session: AuthSession): AuthSession {
  return {
    ...session,
    expiresAt: new Date(session.expiresAt.getTime()),
    revokedAt: session.revokedAt ? new Date(session.revokedAt.getTime()) : null,
    createdAt: new Date(session.createdAt.getTime()),
  };
}

class InMemoryAuthSessionsRepository implements AuthSessionsRepository {
  public readonly sessions: AuthSession[] = [];

  async create(session: CreateAuthSessionParams): Promise<void> {
    this.sessions.push(
      cloneSession({
        ...session,
        revokedAt: null,
      }),
    );
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<AuthSession | null> {
    const session = this.sessions.find(
      (item) => item.refreshTokenHash === refreshTokenHash,
    );

    return session ? cloneSession(session) : null;
  }

  async rotate(params: RotateAuthSessionParams): Promise<RotateAuthSessionResult> {
    const currentSession = this.sessions.find(
      (session) => session.refreshTokenHash === params.currentRefreshTokenHash,
    );

    if (!currentSession) return { status: 'not-found' };

    if (currentSession.revokedAt) {
      const revokedAt = currentSession.revokedAt;
      const hasSuccessor = this.sessions.some(
        (session) =>
          session.id !== currentSession.id &&
          session.tokenFamilyId === currentSession.tokenFamilyId &&
          session.createdAt.getTime() >= revokedAt.getTime(),
      );

      return hasSuccessor
        ? {
            status: 'reuse-detected',
            tokenFamilyId: currentSession.tokenFamilyId,
          }
        : { status: 'revoked' };
    }

    if (currentSession.expiresAt.getTime() <= params.revokedAt.getTime()) {
      return { status: 'expired' };
    }

    currentSession.revokedAt = new Date(params.revokedAt.getTime());

    await this.create({
      ...params.successor,
      userId: currentSession.userId,
      tokenFamilyId: currentSession.tokenFamilyId,
      expiresAt: currentSession.expiresAt,
    });

    return { status: 'rotated' };
  }

  async revokeCurrent(params: RevokeAuthSessionParams): Promise<void> {
    const session = this.sessions.find(
      (item) => item.refreshTokenHash === params.refreshTokenHash,
    );

    if (session && !session.revokedAt) {
      session.revokedAt = new Date(params.revokedAt.getTime());
    }
  }

  async revokeAllByUserId(params: RevokeUserAuthSessionsParams): Promise<void> {
    for (const session of this.sessions) {
      if (session.userId === params.userId && !session.revokedAt) {
        session.revokedAt = new Date(params.revokedAt.getTime());
      }
    }
  }

  async revokeFamily(params: RevokeAuthSessionFamilyParams): Promise<void> {
    for (const session of this.sessions) {
      if (session.tokenFamilyId === params.tokenFamilyId && !session.revokedAt) {
        session.revokedAt = new Date(params.revokedAt.getTime());
      }
    }
  }
}

export { InMemoryAuthSessionsRepository };
