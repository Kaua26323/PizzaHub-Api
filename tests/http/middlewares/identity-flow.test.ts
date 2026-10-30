import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { testPool } from '@tests/setup/postgres';
import { env } from '@/infrastructure/config/env';
import { createApplicationServer } from '@/main/server';

const password = 'StrongPassword123!';
const csrf = { 'X-CSRF-Protection': '1' };

function refreshCookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const setCookie = response.headers['set-cookie'];
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  expect(first).toBeDefined();
  return first!.split(';')[0]!;
}

async function register(
  server: ReturnType<typeof createApplicationServer>,
  email: string,
) {
  return request(server)
    .post('/auth/register')
    .send({ name: 'Pizza Staff', email, password })
    .expect(201);
}

async function login(server: ReturnType<typeof createApplicationServer>, email: string) {
  return request(server).post('/auth/login').send({ email, password }).expect(200);
}

function expectInvalidRefresh(body: unknown) {
  expect(body).toEqual({
    success: false,
    data: null,
    error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token.' },
  });
}

describe('Identity HTTP API with PostgreSQL', () => {
  it('should register STAFF, reject duplicates and client role assignment, and authenticate without exposing secrets', async () => {
    const server = createApplicationServer();
    const registered = await register(server, 'staff@example.com');

    expect(registered.body).toMatchObject({
      success: true,
      data: { email: 'staff@example.com', role: 'STAFF' },
      error: null,
    });

    expect(Object.keys(registered.body.data).sort()).toEqual([
      'createdAt',
      'email',
      'id',
      'name',
      'role',
      'updatedAt',
    ]);

    expect(JSON.stringify(registered.body)).not.toContain(password);

    const duplicate = await request(server)
      .post('/auth/register')
      .send({ name: 'Other', email: 'staff@example.com', password })
      .expect(409);

    expect(duplicate.body).toEqual({
      success: false,
      data: null,
      error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email already exists.' },
    });

    const invalid = await request(server)
      .post('/auth/register')
      .send({ name: 'Other', email: 'bad', password })
      .expect(400);

    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const elevated = await request(server)
      .post('/auth/register')
      .send({ name: 'Other', email: 'other@example.com', password, role: 'ADMIN' })
      .expect(400);

    expect(elevated.body.error.code).toBe('VALIDATION_ERROR');

    const authenticated = await login(server, 'staff@example.com');

    expect(authenticated.body).toEqual({
      success: true,
      data: {
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      },
      error: null,
    });

    expect(refreshCookie(authenticated)).toMatch(/^pizzahub_refresh=[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(authenticated.body)).not.toContain(password);
    expect(JSON.stringify(authenticated.body)).not.toContain(
      refreshCookie(authenticated).split('=')[1],
    );

    const missingEmail = await request(server)
      .post('/auth/login')
      .send({ email: 'missing@example.com', password })
      .expect(401);
    const wrongPassword = await request(server)
      .post('/auth/login')
      .send({ email: 'staff@example.com', password: 'wrong' })
      .expect(401);
    expect(missingEmail.body).toEqual(wrongPassword.body);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should rotate a refresh cookie without extending its absolute expiration and revoke the family on reuse', async () => {
    const server = createApplicationServer();
    await register(server, 'rotate@example.com');
    const loggedIn = await login(server, 'rotate@example.com');
    const originalCookie = refreshCookie(loggedIn);
    const original = await testPool.query<{
      expires_at: Date;
      refresh_token_hash: string;
      revoked_at: Date | null;
    }>('SELECT expires_at, refresh_token_hash, revoked_at FROM auth_sessions');
    expect(original.rows).toHaveLength(1);
    expect(original.rows[0]?.refresh_token_hash).not.toContain(
      originalCookie.split('=')[1],
    );
    const shortenedExpiration = new Date(Date.now() + 120_000);
    await testPool.query('UPDATE auth_sessions SET expires_at = $1', [
      shortenedExpiration,
    ]);

    const rotated = await request(server)
      .post('/auth/refresh')
      .set('Cookie', originalCookie)
      .set(csrf)
      .expect(200);
    const nextCookie = refreshCookie(rotated);
    expect(nextCookie).not.toBe(originalCookie);
    expect(rotated.body).toEqual({
      success: true,
      data: {
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      },
      error: null,
    });
    expect(JSON.stringify(rotated.body)).not.toContain(nextCookie.split('=')[1]);
    const profileUsingRotatedToken = await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${rotated.body.data.accessToken}`)
      .expect(200);
    expect(profileUsingRotatedToken.body.data.email).toBe('rotate@example.com');
    const sessions = await testPool.query<{ expires_at: Date; revoked_at: Date | null }>(
      'SELECT expires_at, revoked_at FROM auth_sessions ORDER BY created_at',
    );
    expect(sessions.rows).toHaveLength(2);
    expect(
      sessions.rows.every(
        (row) => row.expires_at.getTime() === shortenedExpiration.getTime(),
      ),
    ).toBe(true);
    expect(sessions.rows.filter((row) => row.revoked_at === null)).toHaveLength(1);
    const maxAge = Number(
      /Max-Age=(\d+)/.exec(String(rotated.headers['set-cookie']))?.[1],
    );
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(120);

    const reused = await request(server)
      .post('/auth/refresh')
      .set('Cookie', originalCookie)
      .set(csrf)
      .expect(401);
    expectInvalidRefresh(reused.body);
    const revokedSuccessor = await request(server)
      .post('/auth/refresh')
      .set('Cookie', nextCookie)
      .set(csrf)
      .expect(401);
    expectInvalidRefresh(revokedSuccessor.body);
  });

  it('should reject expired, missing, and malformed refresh credentials over HTTP', async () => {
    const server = createApplicationServer();
    await register(server, 'expired@example.com');
    const cookie = refreshCookie(await login(server, 'expired@example.com'));
    await testPool.query('UPDATE auth_sessions SET expires_at = $1', [
      new Date(Date.now() - 1000),
    ]);
    expectInvalidRefresh(
      (
        await request(server)
          .post('/auth/refresh')
          .set('Cookie', cookie)
          .set(csrf)
          .expect(401)
      ).body,
    );
    expectInvalidRefresh(
      (await request(server).post('/auth/refresh').set(csrf).expect(401)).body,
    );
    expectInvalidRefresh(
      (
        await request(server)
          .post('/auth/refresh')
          .set('Cookie', 'pizzahub_refresh=bad')
          .set(csrf)
          .expect(401)
      ).body,
    );
    expectInvalidRefresh(
      (
        await request(server)
          .post('/auth/refresh')
          .set(csrf)
          .send({ refreshToken: cookie.split('=')[1] })
          .expect(401)
      ).body,
    );
  });

  it('should prevent simultaneous HTTP refresh requests from both rotating one token', async () => {
    const server = createApplicationServer();
    await register(server, 'parallel@example.com');
    const cookie = refreshCookie(await login(server, 'parallel@example.com'));
    const responses = await Promise.all([
      request(server).post('/auth/refresh').set('Cookie', cookie).set(csrf),
      request(server).post('/auth/refresh').set('Cookie', cookie).set(csrf),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
    expectInvalidRefresh(responses.find((response) => response.status === 401)!.body);
    const sessions = await testPool.query<{ revoked_at: Date | null }>(
      'SELECT revoked_at FROM auth_sessions',
    );
    expect(sessions.rows).toHaveLength(2);
    expect(sessions.rows.filter((row) => row.revoked_at === null)).toHaveLength(0);
  });

  it('should revoke only the current session on logout and clear its browser cookie', async () => {
    const server = createApplicationServer();
    await register(server, 'logout@example.com');
    const first = refreshCookie(await login(server, 'logout@example.com'));
    const second = refreshCookie(await login(server, 'logout@example.com'));
    const logout = await request(server)
      .post('/auth/logout')
      .set('Cookie', first)
      .set(csrf)
      .expect(204);
    expect(logout.text).toBe('');
    expect(String(logout.headers['set-cookie'])).toContain('pizzahub_refresh=;');
    expect(String(logout.headers['set-cookie'])).toContain('Max-Age=0');
    expectInvalidRefresh(
      (
        await request(server)
          .post('/auth/refresh')
          .set('Cookie', first)
          .set(csrf)
          .expect(401)
      ).body,
    );
    await request(server)
      .post('/auth/refresh')
      .set('Cookie', second)
      .set(csrf)
      .expect(200);
    expectInvalidRefresh(
      (await request(server).post('/auth/logout').set(csrf).expect(401)).body,
    );
  });

  it('should expose only public profiles and restrict user listing to administrators', async () => {
    const server = createApplicationServer();
    const admin = await register(server, 'admin@example.com');
    const staff = await register(server, 'member@example.com');
    await testPool.query('UPDATE users SET role = $1 WHERE id = $2', [
      'ADMIN',
      admin.body.data.id,
    ]);

    const adminToken = (await login(server, 'admin@example.com')).body.data
      .accessToken as string;
    const staffToken = (await login(server, 'member@example.com')).body.data
      .accessToken as string;

    const profile = await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(profile.body.data).toMatchObject({ id: staff.body.data.id, role: 'STAFF' });
    expect(Object.keys(profile.body.data).sort()).toEqual([
      'createdAt',
      'email',
      'id',
      'name',
      'role',
      'updatedAt',
    ]);

    await request(server).get('/users/me').expect(401);
    await request(server)
      .get('/users')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);

    const listed = await request(server)
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listed.body.data).toHaveLength(2);
    expect(
      listed.body.data.every(
        (user: Record<string, unknown>) =>
          Object.keys(user).sort().join(',') === 'createdAt,email,id,name,role,updatedAt',
      ),
    ).toBe(true);
  });

  it('should restrict role changes and revoke the promoted users refresh sessions', async () => {
    const server = createApplicationServer();
    const admin = await register(server, 'admin@example.com');
    const staff = await register(server, 'member@example.com');
    await testPool.query('UPDATE users SET role = $1 WHERE id = $2', [
      'ADMIN',
      admin.body.data.id,
    ]);

    const adminToken = (await login(server, 'admin@example.com')).body.data
      .accessToken as string;
    const staffLogin1 = await login(server, 'member@example.com');
    const staffLogin2 = await login(server, 'member@example.com');
    const staffToken = staffLogin1.body.data.accessToken as string;
    const staffCookies = [refreshCookie(staffLogin1), refreshCookie(staffLogin2)];

    await request(server)
      .patch(`/users/${admin.body.data.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'STAFF' })
      .expect(403);
    await request(server)
      .patch(`/users/${staff.body.data.id}/role`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ role: 'ADMIN' })
      .expect(403);

    const changed = await request(server)
      .patch(`/users/${staff.body.data.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' })
      .expect(204);
    expect(changed.text).toBe('');

    const changedUser = await testPool.query<{ role: string }>(
      'SELECT role FROM users WHERE id = $1',
      [staff.body.data.id],
    );
    expect(changedUser.rows[0]?.role).toBe('ADMIN');

    for (const cookie of staffCookies) {
      const response = await request(server)
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .set(csrf)
        .expect(401);
      expectInvalidRefresh(response.body);
    }
  });

  it('should revoke all own refresh sessions after logout-all', async () => {
    const server = createApplicationServer();
    await register(server, 'logout-all@example.com');
    const firstLogin = await login(server, 'logout-all@example.com');
    const secondLogin = await login(server, 'logout-all@example.com');
    const accessToken = firstLogin.body.data.accessToken as string;

    const logoutAll = await request(server)
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
    expect(logoutAll.text).toBe('');
    expect(String(logoutAll.headers['set-cookie'])).toContain('Max-Age=0');

    for (const cookie of [refreshCookie(firstLogin), refreshCookie(secondLogin)]) {
      const response = await request(server)
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .set(csrf)
        .expect(401);
      expectInvalidRefresh(response.body);
    }

    await request(server).post('/auth/logout-all').expect(401);
  });
});
