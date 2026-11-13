import type { Pool } from 'pg';

import { User } from '@/domain/entities/user';
import type { UserRole } from '@/domain/enums/user-role';
import { withTransaction } from '@/infrastructure/database/postgres/connection/transaction';

import type {
  UsersRepository,
  CreateInitialAdminResult,
  ChangeRoleAndRevokeSessionsParams,
  ChangeRoleAndRevokeSessionsResult,
} from '@/application/repositories/users-repository';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password_hash: string;

  created_at: Date;
  updated_at: Date;
};

function mapUserRow(row: UserRow): User {
  return new User({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

// Dedicated transaction advisory lock shared by bootstrap processes; the fixed key
// ensures they serialize the ADMIN existence check and insert across connections.
const INITIAL_ADMIN_LOCK_KEY = 123456;

class PostgresUsersRepository implements UsersRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: User): Promise<void> {
    const { id, name, email, role, passwordHash, createdAt, updatedAt } = data;

    await this.pool.query(
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
      [id, name, email, role, passwordHash, createdAt, updatedAt],
    );
  }

  async listUsers(): Promise<User[]> {
    const result = await this.pool.query<UserRow>(`
        SELECT id, name, email, role, password_hash, created_at, updated_at
        FROM users
        ORDER BY created_at;
      `);

    return result.rows.map((row) => mapUserRow(row));
  }

  async findById(userId: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `
        SELECT id, name, email, role, password_hash, created_at, updated_at
        FROM users
        WHERE id = $1;
    `,
      [userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return row ? mapUserRow(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      ` 
        SELECT id, name, email, role, password_hash, created_at, updated_at
        FROM users
        WHERE email = $1;
    `,
      [email],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return row ? mapUserRow(row) : null;
  }

  async createInitialAdmin(data: User): Promise<CreateInitialAdminResult> {
    return withTransaction(this.pool, async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock($1)`, [INITIAL_ADMIN_LOCK_KEY]);

      const result = await client.query<{ exists: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM users
            WHERE role = $1
          ) AS exists;
        `,
        ['ADMIN'],
      );

      if (result.rows[0]?.exists) {
        return { status: 'admin-already-exists' };
      }

      const { id, name, email, role, passwordHash, createdAt, updatedAt } = data;

      await client.query(
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
        [id, name, email, role, passwordHash, createdAt, updatedAt],
      );

      return { status: 'created' };
    });
  }

  async changeRoleAndRevokeSessions(
    params: ChangeRoleAndRevokeSessionsParams,
  ): Promise<ChangeRoleAndRevokeSessionsResult> {
    return withTransaction(this.pool, async (client) => {
      const updateResult = await client.query(
        `
          UPDATE users
          SET role = $1, updated_at = $2
          WHERE id = $3;
        `,
        [params.role, params.revokedAt, params.userId],
      );

      if (updateResult.rowCount === 0) {
        return { status: 'not-found' };
      }

      await client.query(
        `
          UPDATE auth_sessions
          SET revoked_at = $1
          WHERE user_id = $2 AND revoked_at IS NULL;
        `,
        [params.revokedAt, params.userId],
      );

      return { status: 'changed' };
    });
  }
}

export { PostgresUsersRepository };
