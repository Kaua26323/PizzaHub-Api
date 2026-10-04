import { describe, expect, it } from 'vitest';

import { User } from '@/domain/entities/user';
import type { UserProps } from '@/domain/entities/user';

import { PostgresUsersRepository } from '@/infrastructure/database/postgres/repositories/postgres-users-repository';

import { testPool } from '@tests/setup/postgres';

const currentDate = new Date('2026-01-10T13:15:00.000Z');
const roleChangedAt = new Date('2026-01-11T13:15:00.000Z');

function makeSut() {
  const postgresUsersRepository = new PostgresUsersRepository(testPool);

  return { postgresUsersRepository };
}

function makeUser(overrides: Partial<UserProps> = {}): User {
  return new User({
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Kauan Souza',
    email: 'admin123@gmail.com',
    role: 'ADMIN',
    passwordHash: '$2b$12$K9vF3dQ8sLp7Nx2YmT4RPeH1xVaC6ZuJ5WoB0GcE9AiFqMdL7SnKy',
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

async function createSession(
  id: string,
  userId: string,
  revokedAt: Date | null = null,
): Promise<void> {
  await testPool.query(
    'INSERT INTO auth_sessions (id, user_id, token_family_id, refresh_token_hash, expires_at, revoked_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      id,
      userId,
      id,
      'hash:' + id,
      new Date('2026-01-18T13:15:00.000Z'),
      revokedAt,
      currentDate,
    ],
  );
}

describe('PostgresUsersRepository', () => {
  const { postgresUsersRepository } = makeSut();

  describe('create', () => {
    it('should successfully create a new user', async () => {
      await postgresUsersRepository.create(makeUser());

      const result = await postgresUsersRepository.findById(
        '550e8400-e29b-41d4-a716-446655440001',
      );

      expect(result?.id).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(result?.name).toBe('Kauan Souza');
      expect(result?.email).toBe('admin123@gmail.com');
      expect(result?.role).toBe('ADMIN');
      expect(result?.createdAt).toStrictEqual(currentDate);
      expect(result?.updatedAt).toStrictEqual(currentDate);
    });

    it('should fail when creating a user with a duplicate email', async () => {
      await postgresUsersRepository.create(makeUser());

      await expect(
        postgresUsersRepository.create(
          makeUser({
            id: '000a0000-a11b-11a1-c111-111111111111',
            name: 'Another Name',
          }),
        ),
      ).rejects.toMatchObject({ code: '23505' }); // PostgreSQL unique_violation error
    });
  });

  describe('listUsers', () => {
    it('should list the users from database', async () => {
      await postgresUsersRepository.create(makeUser());

      const result = await postgresUsersRepository.listUsers();

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(User);
      expect(result[0]?.id).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(result[0]?.name).toBe('Kauan Souza');
      expect(result[0]?.email).toBe('admin123@gmail.com');
      expect(result[0]?.role).toBe('ADMIN');
      expect(result[0]?.createdAt).toStrictEqual(currentDate);
      expect(result[0]?.updatedAt).toStrictEqual(currentDate);
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';

      await postgresUsersRepository.create(makeUser());

      const result = await postgresUsersRepository.findById(userId);

      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(result?.name).toBe('Kauan Souza');
      expect(result?.email).toBe('admin123@gmail.com');
      expect(result?.role).toBe('ADMIN');
      expect(result?.createdAt).toStrictEqual(currentDate);
      expect(result?.updatedAt).toStrictEqual(currentDate);
    });

    it('should return null when the user id does not exist', async () => {
      await expect(
        postgresUsersRepository.findById('00000000-0000-4000-8000-000000000001'),
      ).resolves.toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      const { postgresUsersRepository } = makeSut();
      const user = makeUser();

      await postgresUsersRepository.create(user);

      const result = await postgresUsersRepository.findByEmail(user.email);

      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe(user.id);
      expect(result?.email).toBe(user.email);
      expect(result?.passwordHash).toBe(user.passwordHash);
      expect(result?.createdAt).toStrictEqual(currentDate);
      expect(result?.updatedAt).toStrictEqual(currentDate);
    });

    it('should return null when the user email does not exist', async () => {
      await expect(
        postgresUsersRepository.findByEmail('missing@example.com'),
      ).resolves.toBeNull();
    });
  });

  describe('changeRoleAndRevokeSessions', () => {
    it('should change the role and revoke only the target user active sessions', async () => {
      const target = makeUser({ role: 'STAFF' });

      const other = makeUser({
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'other@example.com',
      });

      const activeTargetSessionId = '550e8400-e29b-41d4-a716-446655440011';
      const revokedTargetSessionId = '550e8400-e29b-41d4-a716-446655440012';
      const otherSessionId = '550e8400-e29b-41d4-a716-446655440013';
      const previouslyRevokedAt = new Date('2026-01-10T15:00:00.000Z');

      await postgresUsersRepository.create(target);
      await postgresUsersRepository.create(other);
      await createSession(activeTargetSessionId, target.id);
      await createSession(revokedTargetSessionId, target.id, previouslyRevokedAt);
      await createSession(otherSessionId, other.id);

      const result = await postgresUsersRepository.changeRoleAndRevokeSessions({
        userId: target.id,
        role: 'ADMIN',
        revokedAt: roleChangedAt,
      });

      const updatedTarget = await postgresUsersRepository.findById(target.id);
      const unchangedOther = await postgresUsersRepository.findById(other.id);
      const sessions = await testPool.query<{ id: string; revoked_at: Date | null }>(
        'SELECT id, revoked_at FROM auth_sessions',
      );
      const revokedAtById = new Map(
        sessions.rows.map((session) => [session.id, session.revoked_at]),
      );

      expect(result).toEqual({ status: 'changed' });
      expect(updatedTarget?.role).toBe('ADMIN');
      expect(updatedTarget?.updatedAt).toStrictEqual(roleChangedAt);
      expect(unchangedOther?.role).toBe(other.role);
      expect(unchangedOther?.updatedAt).toStrictEqual(currentDate);
      expect(revokedAtById.get(activeTargetSessionId)).toStrictEqual(roleChangedAt);
      expect(revokedAtById.get(revokedTargetSessionId)).toStrictEqual(
        previouslyRevokedAt,
      );
      expect(revokedAtById.get(otherSessionId)).toBeNull();
    });

    it('should not change users or sessions when the target user does not exist', async () => {
      const existingUser = makeUser();
      const sessionId = '550e8400-e29b-41d4-a716-446655440011';

      await postgresUsersRepository.create(existingUser);
      await createSession(sessionId, existingUser.id);

      const result = await postgresUsersRepository.changeRoleAndRevokeSessions({
        userId: '00000000-0000-4000-8000-000000000001',
        role: 'STAFF',
        revokedAt: roleChangedAt,
      });

      const userAfterChange = await postgresUsersRepository.findById(existingUser.id);

      const sessions = await testPool.query<{ revoked_at: Date | null }>(
        'SELECT revoked_at FROM auth_sessions WHERE id = $1',
        [sessionId],
      );

      expect(result).toEqual({ status: 'not-found' });
      expect(userAfterChange?.role).toBe('ADMIN');
      expect(userAfterChange?.updatedAt).toStrictEqual(currentDate);
      expect(sessions.rows[0]?.revoked_at).toBeNull();
    });

    it('should change the role when the user has no active sessions', async () => {
      const user = makeUser({
        role: 'STAFF',
      });

      await postgresUsersRepository.create(user);

      const result = await postgresUsersRepository.changeRoleAndRevokeSessions({
        userId: user.id,
        role: 'ADMIN',
        revokedAt: roleChangedAt,
      });

      const updatedUser = await postgresUsersRepository.findById(user.id);

      expect(result).toEqual({
        status: 'changed',
      });

      expect(updatedUser?.role).toBe('ADMIN');
      expect(updatedUser?.updatedAt).toStrictEqual(roleChangedAt);
    });

    it('should roll back the role change when session revocation fails', async () => {
      const user = makeUser({ role: 'STAFF' });
      const sessionId = '550e8400-e29b-41d4-a716-446655440011';

      await postgresUsersRepository.create(user);
      await createSession(sessionId, user.id);

      await testPool.query(
        'ALTER TABLE auth_sessions ADD CONSTRAINT test_revoked_at_must_be_null CHECK (revoked_at IS NULL)',
      );

      try {
        await expect(
          postgresUsersRepository.changeRoleAndRevokeSessions({
            userId: user.id,
            role: 'ADMIN',
            revokedAt: roleChangedAt,
          }),
        ).rejects.toMatchObject({
          code: '23514',
          constraint: 'test_revoked_at_must_be_null',
        });

        const persistedUser = await postgresUsersRepository.findById(user.id);
        const session = await testPool.query<{ revoked_at: Date | null }>(
          'SELECT revoked_at FROM auth_sessions WHERE id = $1',
          [sessionId],
        );

        expect(persistedUser?.role).toBe('STAFF');
        expect(persistedUser?.updatedAt).toStrictEqual(currentDate);
        expect(session.rows[0]?.revoked_at).toBeNull();
      } finally {
        await testPool.query(
          'ALTER TABLE auth_sessions DROP CONSTRAINT test_revoked_at_must_be_null',
        );
      }
    });
  });
});
