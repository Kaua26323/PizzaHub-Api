import type { Pool } from 'pg';
import { withTransaction } from '@/infrastructure/database/postgres/connection/transaction';

import type {
  AuthSession,
  AuthSessionsRepository,
  CreateAuthSessionParams,
  RevokeAuthSessionParams,
  RotateAuthSessionParams,
  RotateAuthSessionResult,
  RevokeUserAuthSessionsParams,
  RevokeAuthSessionFamilyParams,
} from '@/application/repositories/auth-sessions-repository';

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

function mapAuthSessionRow(row: AuthSessionRow): AuthSession {
  return {
    id: row.id,
    userId: row.user_id,
    tokenFamilyId: row.token_family_id,
    refreshTokenHash: row.refresh_token_hash,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

class PostgresAuthSessionsRepository implements AuthSessionsRepository {
  constructor(private readonly pool: Pool) {}

  async create(session: CreateAuthSessionParams): Promise<void> {
    const {
      id,
      userId,
      tokenFamilyId,
      refreshTokenHash,
      ipAddress,
      userAgent,
      expiresAt,
      createdAt,
    } = session;

    await this.pool.query(
      `
      INSERT INTO auth_sessions (
        id,
        user_id,
        token_family_id,
        refresh_token_hash,
        ip_address,
        user_agent,
        expires_at, 
        created_at
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, $8);
    `,
      [
        id,
        userId,
        tokenFamilyId,
        refreshTokenHash,
        ipAddress,
        userAgent,
        expiresAt,
        createdAt,
      ],
    );
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<AuthSession | null> {
    const result = await this.pool.query<AuthSessionRow>(
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

    const row = result.rows[0];

    return row ? mapAuthSessionRow(row) : null;
  }

  async rotate(params: RotateAuthSessionParams): Promise<RotateAuthSessionResult> {
    const { currentRefreshTokenHash, revokedAt, successor } = params;

    return withTransaction(this.pool, async (client) => {
      const sessionQuery = await client.query<AuthSessionRow>(
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
          WHERE refresh_token_hash = $1
          FOR UPDATE;
        `,
        [currentRefreshTokenHash],
      );

      const session = sessionQuery.rows[0];

      if (!session) {
        return { status: 'not-found' };
      }

      if (session.expires_at <= revokedAt) {
        return { status: 'expired' };
      }

      if (session.revoked_at !== null) {
        const successorQuery = await client.query<{ id: string }>(
          `
            SELECT id
            FROM auth_sessions
            WHERE token_family_id = $1
              AND revoked_at IS NULL
            LIMIT 1;
          `,
          [session.token_family_id],
        );

        const hasActiveSuccessor = successorQuery.rows.length > 0;

        if (!hasActiveSuccessor) {
          return { status: 'revoked' };
        }

        await client.query(
          `
            UPDATE auth_sessions
            SET revoked_at = $1
            WHERE token_family_id = $2
              AND revoked_at IS NULL;
         `,
          [revokedAt, session.token_family_id],
        );

        return {
          status: 'reuse-detected',
          tokenFamilyId: session.token_family_id,
        };
      }

      await client.query(
        `
         UPDATE auth_sessions
         SET revoked_at = $1
         WHERE id = $2
           AND revoked_at IS NULL;
       `,
        [revokedAt, session.id],
      );

      await client.query(
        `
          INSERT INTO auth_sessions (
            id,
            user_id,
            token_family_id,
            refresh_token_hash,
            ip_address,
            user_agent,
            expires_at, 
            created_at
          )
          VALUES($1, $2, $3, $4, $5, $6, $7, $8);
        `,
        [
          successor.id,
          session.user_id,
          session.token_family_id,
          successor.refreshTokenHash,
          successor.ipAddress,
          successor.userAgent,
          session.expires_at,
          successor.createdAt,
        ],
      );

      return { status: 'rotated' };
    });
  }

  async revokeCurrent(params: RevokeAuthSessionParams): Promise<void> {
    await this.pool.query(
      `
      UPDATE auth_sessions
      SET revoked_at = $1
      WHERE refresh_token_hash = $2
        AND revoked_at IS NULL
    `,
      [params.revokedAt, params.refreshTokenHash],
    );
  }

  async revokeAllByUserId(params: RevokeUserAuthSessionsParams): Promise<void> {
    await this.pool.query(
      `
      UPDATE auth_sessions
      SET revoked_at = $1
      WHERE user_id = $2
        AND revoked_at IS NULL;
    `,
      [params.revokedAt, params.userId],
    );
  }

  async revokeFamily(params: RevokeAuthSessionFamilyParams): Promise<void> {
    await this.pool.query(
      `
      UPDATE auth_sessions
      SET revoked_at = $1
      WHERE token_family_id = $2
        AND revoked_at IS NULL;
    `,
      [params.revokedAt, params.tokenFamilyId],
    );
  }
}
export { PostgresAuthSessionsRepository };
