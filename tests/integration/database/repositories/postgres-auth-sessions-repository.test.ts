import { describe, expect, it } from 'vitest';
import { testPool } from '@tests/setup/postgres';
import type { UserProps } from '@/domain/entities/user';
import { PostgresAuthSessionsRepository } from '@/infrastructure/database/postgres/repositories/postgres-auth-sessions-repository';
import type {
  AuthSession,
  CreateAuthSessionParams,
  RotateAuthSessionParams,
} from '@/application/repositories/auth-sessions-repository';

const currentDate = new Date('2026-01-10T13:15:00.000Z');
const rotatedAt = new Date('2026-01-11T13:15:00.000Z');
const reuseDetectedAt = new Date('2026-01-12T13:15:00.000Z');
const expiresAt = new Date('2026-01-18T13:15:00.000Z');
const previouslyRevokedAt = new Date('2026-01-09T13:15:00.000Z');

type AuthSessionRow = {
  id: string;
  user_id: string;
  token_family_id: string;
  refresh_token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
};

type SuccessorSession = RotateAuthSessionParams['successor'];

function makeSut() {
  const sut = new PostgresAuthSessionsRepository(testPool);

  return { sut };
}

function makeUser(overrides: Partial<UserProps> = {}): UserProps {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Kauan Souza',
    email: 'admin123@gmail.com',
    role: 'ADMIN',
    passwordHash: '$2b$12$K9vF3dQ8sLp7Nx2YmT4RPeH1xVaC6ZuJ5WoB0GcE9AiFqMdL7SnKy',
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  };
}

function makeSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    id: '440e9511-a29b-52e5-b827-557766551122',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    tokenFamilyId: '440e9511-a29b-52e5-b827-557766551122',
    refreshTokenHash: 'hash:440e9511-a29b-52e5-b827-557766551122',
    ipAddress: '203.0.113.10',
    userAgent: 'PizzaHub Integration Test Agent',
    expiresAt,
    revokedAt: null,
    createdAt: currentDate,
    ...overrides,
  };
}

function makeSuccessor(overrides: Partial<SuccessorSession> = {}): SuccessorSession {
  return {
    id: '000e0000-a29b-52e5-b827-557766551122',
    refreshTokenHash: 'hash:000e0000-a29b-52e5-b827-557766551122',
    ipAddress: '203.0.113.20',
    userAgent: 'PizzaHub Successor Agent',
    createdAt: rotatedAt,
    ...overrides,
  };
}

function toCreateParams(session: AuthSession): CreateAuthSessionParams {
  return {
    id: session.id,
    userId: session.userId,
    tokenFamilyId: session.tokenFamilyId,
    refreshTokenHash: session.refreshTokenHash,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
  };
}

async function insertUser(user: UserProps): Promise<void> {
  await testPool.query(
    `
      INSERT INTO users (
        id,
        name,
        email,
        role,
        password_hash,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7);
    `,
    [
      user.id,
      user.name,
      user.email,
      user.role,
      user.passwordHash,
      user.createdAt,
      user.updatedAt,
    ],
  );
}

async function insertSession(session: AuthSession): Promise<void> {
  await testPool.query(
    `
      INSERT INTO auth_sessions (
        id,
        user_id,
        token_family_id,
        refresh_token_hash,
        ip_address,
        user_agent,
        expires_at,
        revoked_at,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9
      );
    `,
    [
      session.id,
      session.userId,
      session.tokenFamilyId,
      session.refreshTokenHash,
      session.ipAddress,
      session.userAgent,
      session.expiresAt,
      session.revokedAt,
      session.createdAt,
    ],
  );
}

async function findSessionRowByHash(
  refreshTokenHash: string,
): Promise<AuthSessionRow | null> {
  const result = await testPool.query<AuthSessionRow>(
    `
        SELECT
          id,
          user_id,
          token_family_id,
          refresh_token_hash,
          ip_address,
          user_agent,
          expires_at,
          revoked_at,
          created_at
        FROM auth_sessions
        WHERE refresh_token_hash = $1;
      `,
    [refreshTokenHash],
  );

  return result.rows[0] ?? null;
}

describe('PostgresAuthSessionsRepository', () => {
  describe('create', () => {
    it('should create an auth session', async () => {
      const { sut } = makeSut();

      const user = makeUser();
      const session = makeSession();

      await insertUser(user);

      await sut.create(toCreateParams(session));

      const row = await findSessionRowByHash(session.refreshTokenHash);

      expect(row).not.toBeNull();

      expect(row?.id).toBe(session.id);
      expect(row?.user_id).toBe(session.userId);

      expect(row?.token_family_id).toBe(session.tokenFamilyId);

      expect(row?.refresh_token_hash).toBe(session.refreshTokenHash);

      expect(row?.ip_address).toBe(session.ipAddress);

      expect(row?.user_agent).toBe(session.userAgent);

      expect(row?.expires_at).toStrictEqual(session.expiresAt);

      expect(row?.revoked_at).toBeNull();

      expect(row?.created_at).toStrictEqual(session.createdAt);
    });
  });

  describe('findByRefreshTokenHash', () => {
    it('should return a session by refresh token hash', async () => {
      const { sut } = makeSut();

      const user = makeUser();
      const session = makeSession();

      await insertUser(user);
      await insertSession(session);

      const result = await sut.findByRefreshTokenHash(session.refreshTokenHash);

      expect(result).toEqual(session);
    });

    it('should return null when the session does not exist', async () => {
      const { sut } = makeSut();

      const result = await sut.findByRefreshTokenHash('hash:missing-session');

      expect(result).toBeNull();
    });
  });

  describe('rotate', () => {
    it('should revoke the current session and create exactly one successor', async () => {
      const { sut } = makeSut();

      const user = makeUser();
      const session = makeSession();
      const successor = makeSuccessor();

      await insertUser(user);
      await insertSession(session);

      const result = await sut.rotate({
        currentRefreshTokenHash: session.refreshTokenHash,
        revokedAt: rotatedAt,
        successor,
      });

      expect(result).toEqual({
        status: 'rotated',
      });

      const oldSession = await findSessionRowByHash(session.refreshTokenHash);

      const newSession = await findSessionRowByHash(successor.refreshTokenHash);

      expect(oldSession?.revoked_at).toStrictEqual(rotatedAt);

      expect(newSession).not.toBeNull();

      expect(newSession?.id).toBe(successor.id);

      expect(newSession?.user_id).toBe(session.userId);

      expect(newSession?.token_family_id).toBe(session.tokenFamilyId);

      expect(newSession?.refresh_token_hash).toBe(successor.refreshTokenHash);

      expect(newSession?.ip_address).toBe(successor.ipAddress);

      expect(newSession?.user_agent).toBe(successor.userAgent);

      // The absolute expiration must be preserved.
      expect(newSession?.expires_at).toStrictEqual(session.expiresAt);

      expect(newSession?.revoked_at).toBeNull();

      expect(newSession?.created_at).toStrictEqual(successor.createdAt);

      const family = await testPool.query<AuthSessionRow>(
        `
            SELECT
              id,
              user_id,
              token_family_id,
              refresh_token_hash,
              ip_address,
              user_agent,
              expires_at,
              revoked_at,
              created_at
            FROM auth_sessions
            WHERE token_family_id = $1;
          `,
        [session.tokenFamilyId],
      );

      expect(family.rows).toHaveLength(2);

      const activeSessions = family.rows.filter((item) => item.revoked_at === null);

      expect(activeSessions).toHaveLength(1);

      expect(activeSessions[0]?.refresh_token_hash).toBe(successor.refreshTokenHash);
    });

    it('should return not-found when the session does not exist', async () => {
      const { sut } = makeSut();

      const successor = makeSuccessor();

      const result = await sut.rotate({
        currentRefreshTokenHash: 'hash:missing-session',
        revokedAt: rotatedAt,
        successor,
      });

      expect(result).toEqual({
        status: 'not-found',
      });

      const createdSuccessor = await findSessionRowByHash(successor.refreshTokenHash);

      expect(createdSuccessor).toBeNull();
    });

    it('should return expired without revoking the session or creating a successor', async () => {
      const { sut } = makeSut();

      const user = makeUser();

      const session = makeSession({
        expiresAt: rotatedAt,
      });

      const successor = makeSuccessor();

      await insertUser(user);
      await insertSession(session);

      const result = await sut.rotate({
        currentRefreshTokenHash: session.refreshTokenHash,
        revokedAt: rotatedAt,
        successor,
      });

      expect(result).toEqual({
        status: 'expired',
      });

      const oldSession = await findSessionRowByHash(session.refreshTokenHash);

      const createdSuccessor = await findSessionRowByHash(successor.refreshTokenHash);

      expect(oldSession?.revoked_at).toBeNull();
      expect(createdSuccessor).toBeNull();
    });

    it('should return revoked for a revoked session without an active successor', async () => {
      const { sut } = makeSut();

      const user = makeUser();

      const session = makeSession({
        revokedAt: previouslyRevokedAt,
      });

      const successor = makeSuccessor();

      await insertUser(user);
      await insertSession(session);

      const result = await sut.rotate({
        currentRefreshTokenHash: session.refreshTokenHash,
        revokedAt: rotatedAt,
        successor,
      });

      expect(result).toEqual({
        status: 'revoked',
      });

      const oldSession = await findSessionRowByHash(session.refreshTokenHash);

      const createdSuccessor = await findSessionRowByHash(successor.refreshTokenHash);

      expect(oldSession?.revoked_at).toStrictEqual(previouslyRevokedAt);

      expect(createdSuccessor).toBeNull();
    });

    it('should detect refresh token reuse and revoke the active session in the token family', async () => {
      const { sut } = makeSut();

      const user = makeUser();

      const oldSession = makeSession({
        revokedAt: rotatedAt,
      });

      const activeSuccessor = makeSession({
        id: '000e0000-a29b-52e5-b827-557766551122',
        refreshTokenHash: 'hash:000e0000-a29b-52e5-b827-557766551122',
        tokenFamilyId: oldSession.tokenFamilyId,
        revokedAt: null,
        createdAt: rotatedAt,
      });

      const attemptedSuccessor = makeSuccessor({
        id: '11111111-1111-4111-8111-111111111111',
        refreshTokenHash: 'hash:11111111-1111-4111-8111-111111111111',
        createdAt: reuseDetectedAt,
      });

      await insertUser(user);

      await insertSession(oldSession);
      await insertSession(activeSuccessor);

      const result = await sut.rotate({
        currentRefreshTokenHash: oldSession.refreshTokenHash,
        revokedAt: reuseDetectedAt,
        successor: attemptedSuccessor,
      });

      expect(result).toEqual({
        status: 'reuse-detected',
        tokenFamilyId: oldSession.tokenFamilyId,
      });

      const persistedOldSession = await findSessionRowByHash(oldSession.refreshTokenHash);

      const persistedActiveSuccessor = await findSessionRowByHash(
        activeSuccessor.refreshTokenHash,
      );

      const createdAttempt = await findSessionRowByHash(
        attemptedSuccessor.refreshTokenHash,
      );

      // Preserve the original revocation timestamp.
      expect(persistedOldSession?.revoked_at).toStrictEqual(rotatedAt);

      // The currently active member of the family is revoked.
      expect(persistedActiveSuccessor?.revoked_at).toStrictEqual(reuseDetectedAt);

      // Reuse must not create another successor.
      expect(createdAttempt).toBeNull();
    });

    it('should rollback the current-session revocation when successor creation fails', async () => {
      const { sut } = makeSut();

      const user = makeUser();
      const session = makeSession();

      await insertUser(user);
      await insertSession(session);

      const invalidSuccessor = makeSuccessor({
        // Same PK as the existing session.
        id: session.id,
        refreshTokenHash: 'hash:new-successor',
      });

      await expect(
        sut.rotate({
          currentRefreshTokenHash: session.refreshTokenHash,
          revokedAt: rotatedAt,
          successor: invalidSuccessor,
        }),
      ).rejects.toThrow();

      const oldSession = await findSessionRowByHash(session.refreshTokenHash);

      const createdSuccessor = await findSessionRowByHash(
        invalidSuccessor.refreshTokenHash,
      );

      // UPDATE must have been rolled back.
      expect(oldSession?.revoked_at).toBeNull();

      expect(createdSuccessor).toBeNull();
    });

    it('should create only one successor when the same token is rotated concurrently', async () => {
      const { sut } = makeSut();

      const session = makeSession();

      const firstSuccessor = makeSuccessor();
      const secondSuccessor = makeSuccessor({
        id: '000e0000-a29b-52e5-b827-557766551123',
        refreshTokenHash: 'hash:000e0000-a29b-52e5-b827-557766551123',
      });

      await insertUser(makeUser());
      await insertSession(session);

      const results = await Promise.all([
        sut.rotate({
          currentRefreshTokenHash: session.refreshTokenHash,
          revokedAt: rotatedAt,
          successor: firstSuccessor,
        }),
        sut.rotate({
          currentRefreshTokenHash: session.refreshTokenHash,
          revokedAt: rotatedAt,
          successor: secondSuccessor,
        }),
      ]);

      expect(results.map((result) => result.status).sort()).toEqual([
        'reuse-detected',
        'rotated',
      ]);

      const family = await testPool.query<AuthSessionRow>(
        'SELECT * FROM auth_sessions WHERE token_family_id = $1',
        [session.tokenFamilyId],
      );

      expect(family.rows).toHaveLength(2);
      expect(family.rows.filter((row) => row.revoked_at === null)).toHaveLength(0);
      expect(
        family.rows
          .filter((row) => row.id !== session.id)
          .map((row) => row.refresh_token_hash),
      ).toEqual([
        expect.stringMatching(/^hash:000e0000-a29b-52e5-b827-55776655112[23]$/),
      ]);
    });

    it('should rotate another session while one session row is locked', async () => {
      const { sut } = makeSut();

      const first = makeSession();
      const second = makeSession({
        id: '440e9511-a29b-52e5-b827-557766551123',
        tokenFamilyId: '440e9511-a29b-52e5-b827-557766551123',
        refreshTokenHash: 'hash:440e9511-a29b-52e5-b827-557766551123',
      });

      await insertUser(makeUser());
      await insertSession(first);
      await insertSession(second);

      const blocker = await testPool.connect();
      let firstRotation: ReturnType<typeof sut.rotate> | undefined;

      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM auth_sessions WHERE id = $1 FOR UPDATE', [
          first.id,
        ]);

        firstRotation = sut.rotate({
          currentRefreshTokenHash: first.refreshTokenHash,
          revokedAt: rotatedAt,
          successor: makeSuccessor(),
        });

        const secondRotation = sut.rotate({
          currentRefreshTokenHash: second.refreshTokenHash,
          revokedAt: rotatedAt,
          successor: makeSuccessor({
            id: '000e0000-a29b-52e5-b827-557766551123',
            refreshTokenHash: 'hash:000e0000-a29b-52e5-b827-557766551123',
          }),
        });

        let timer: ReturnType<typeof setTimeout> | undefined;

        try {
          const result = await Promise.race([
            secondRotation,
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error('Independent rotation was blocked.')),
                2000,
              );
            }),
          ]);

          expect(result).toEqual({ status: 'rotated' });
          expect(await findSessionRowByHash(second.refreshTokenHash)).toMatchObject({
            revoked_at: rotatedAt,
          });
        } finally {
          if (timer) clearTimeout(timer);
        }
      } finally {
        await blocker.query('ROLLBACK');
        blocker.release();
      }

      expect(await firstRotation).toEqual({ status: 'rotated' });
    });
  });

  describe('revokeCurrent', () => {
    it('should revoke the current active session', async () => {
      const { sut } = makeSut();

      const user = makeUser();
      const session = makeSession();

      await insertUser(user);
      await insertSession(session);

      await sut.revokeCurrent({
        refreshTokenHash: session.refreshTokenHash,
        revokedAt: rotatedAt,
      });

      const persisted = await findSessionRowByHash(session.refreshTokenHash);

      expect(persisted?.revoked_at).toStrictEqual(rotatedAt);
    });

    it('should revoke the current session idempotently', async () => {
      const { sut } = makeSut();

      const user = makeUser();
      const session = makeSession();

      await insertUser(user);
      await insertSession(session);

      await sut.revokeCurrent({
        refreshTokenHash: session.refreshTokenHash,
        revokedAt: rotatedAt,
      });

      await sut.revokeCurrent({
        refreshTokenHash: session.refreshTokenHash,
        revokedAt: reuseDetectedAt,
      });

      const persisted = await findSessionRowByHash(session.refreshTokenHash);

      expect(persisted?.revoked_at).toStrictEqual(rotatedAt);
    });
  });

  describe('revokeAllByUserId', () => {
    it('should revoke only active sessions owned by the target user', async () => {
      const { sut } = makeSut();

      const targetUser = makeUser();

      const otherUser = makeUser({
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'other@example.com',
      });

      const targetSession1 = makeSession();

      const targetSession2 = makeSession({
        id: '440e9511-a29b-52e5-b827-557766551123',
        tokenFamilyId: '440e9511-a29b-52e5-b827-557766551123',
        refreshTokenHash: 'hash:440e9511-a29b-52e5-b827-557766551123',
      });

      const alreadyRevokedTargetSession = makeSession({
        id: '440e9511-a29b-52e5-b827-557766551124',
        tokenFamilyId: '440e9511-a29b-52e5-b827-557766551124',
        refreshTokenHash: 'hash:440e9511-a29b-52e5-b827-557766551124',
        revokedAt: previouslyRevokedAt,
      });

      const otherSession = makeSession({
        id: '440e9511-a29b-52e5-b827-557766551125',
        userId: otherUser.id,
        tokenFamilyId: '440e9511-a29b-52e5-b827-557766551125',
        refreshTokenHash: 'hash:440e9511-a29b-52e5-b827-557766551125',
      });

      await insertUser(targetUser);
      await insertUser(otherUser);

      await insertSession(targetSession1);
      await insertSession(targetSession2);

      await insertSession(alreadyRevokedTargetSession);

      await insertSession(otherSession);

      await sut.revokeAllByUserId({
        userId: targetUser.id,
        revokedAt: rotatedAt,
      });

      const first = await findSessionRowByHash(targetSession1.refreshTokenHash);

      const second = await findSessionRowByHash(targetSession2.refreshTokenHash);

      const alreadyRevoked = await findSessionRowByHash(
        alreadyRevokedTargetSession.refreshTokenHash,
      );

      const other = await findSessionRowByHash(otherSession.refreshTokenHash);

      expect(first?.revoked_at).toStrictEqual(rotatedAt);

      expect(second?.revoked_at).toStrictEqual(rotatedAt);

      expect(alreadyRevoked?.revoked_at).toStrictEqual(previouslyRevokedAt);

      expect(other?.revoked_at).toBeNull();
    });
  });

  describe('revokeFamily', () => {
    it('should revoke only active sessions in the target token family', async () => {
      const { sut } = makeSut();

      const user = makeUser();

      const familyId = '440e9511-a29b-52e5-b827-557766551122';

      const oldSession = makeSession({
        tokenFamilyId: familyId,
        revokedAt: previouslyRevokedAt,
      });

      const activeSession = makeSession({
        id: '440e9511-a29b-52e5-b827-557766551123',
        tokenFamilyId: familyId,
        refreshTokenHash: 'hash:440e9511-a29b-52e5-b827-557766551123',
        createdAt: rotatedAt,
      });

      const anotherFamilySession = makeSession({
        id: '440e9511-a29b-52e5-b827-557766551124',
        tokenFamilyId: '999e9999-a29b-52e5-b827-557766551124',
        refreshTokenHash: 'hash:440e9511-a29b-52e5-b827-557766551124',
      });

      await insertUser(user);

      await insertSession(oldSession);
      await insertSession(activeSession);

      await insertSession(anotherFamilySession);

      await sut.revokeFamily({
        tokenFamilyId: familyId,
        revokedAt: rotatedAt,
      });

      const old = await findSessionRowByHash(oldSession.refreshTokenHash);

      const active = await findSessionRowByHash(activeSession.refreshTokenHash);

      const unrelated = await findSessionRowByHash(anotherFamilySession.refreshTokenHash);

      expect(old?.revoked_at).toStrictEqual(previouslyRevokedAt);

      expect(active?.revoked_at).toStrictEqual(rotatedAt);

      expect(unrelated?.revoked_at).toBeNull();
    });
  });
});
