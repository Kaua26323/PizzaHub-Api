import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { Router } from '@/presentation/http/routes/router';
import { createApplicationServer } from '@/main/server';
import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { registerIdentityRoutes } from '@/presentation/http/routes/identity-routes';
import { ChangeUserRoleController } from '@/presentation/http/controllers/identity/change-user-role-controller';
import { ChangeUserRoleUseCase } from '@/application/use-cases/identity/change-user-role';
import { AuthenticationError } from '@/application/errors/authentication-error';

import type { Clock } from '@/application/services/clock';
import type { UsersRepository } from '@/application/repositories/users-repository';
import type { AccessTokenProvider } from '@/application/services/access-token-provider';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';
import type { IdentityRoutesDependencies } from '@/presentation/http/routes/identity-routes';

const adminId = '00000000-0000-4000-8000-000000000001';
const staffId = '00000000-0000-4000-8000-000000000002';

function createRoutes() {
  const calls: string[] = [];

  const handler =
    (name: string): HttpRequestHandler =>
    async (incoming, response) => {
      calls.push(name);

      if (name === 'changeRole') {
        const { actor, params } = getRequestContext(incoming);
        expect(actor).toEqual({ id: adminId, role: 'ADMIN' });
        expect(params.userId).toBe(staffId);
      }

      sendNoContent(response);
    };

  const accessTokenProvider: AccessTokenProvider = {
    issue: vi.fn(async () => 'access-token'),
    verify: vi.fn(async (token) => {
      if (token === 'admin-token') return { userId: adminId, role: 'ADMIN' as const };
      if (token === 'staff-token') return { userId: staffId, role: 'STAFF' as const };
      throw new AuthenticationError('INVALID_ACCESS_TOKEN', 'Invalid access token.');
    }),
  };

  const dependencies: IdentityRoutesDependencies = {
    accessTokenProvider,
    listUsersController: { handler: handler('listUsers') },
    getOwnProfileController: { handler: handler('profile') },
    registerUserController: { handler: handler('register') },
    authenticateUserController: { handler: handler('login') },
    changeUserRoleController: { handler: handler('changeRole') },
    logoutCurrentSessionController: { handler: handler('logout') },
    refreshAuthenticationController: { handler: handler('refresh') },
    logoutAllOwnSessionsController: { handler: handler('logoutAll') },
  };

  const router = new Router();
  registerIdentityRoutes(router, dependencies);

  return { calls, dependencies, server: createApplicationServer(router) };
}

describe('registerIdentityRoutes', () => {
  it.each([
    ['/auth/register', 'register'],
    ['/auth/login', 'login'],
    ['/auth/refresh', 'refresh'],
    ['/auth/logout', 'logout'],
  ])('should route POST %s without requiring an access token', async (path, expected) => {
    const { calls, server } = createRoutes();

    await request(server).post(path).expect(204);

    expect(calls).toEqual([expected]);
  });

  it.each([
    ['post', '/auth/logout-all', 'logoutAll'],
    ['get', '/users/me', 'profile'],
    ['get', '/users', 'listUsers'],
    ['patch', `/users/${staffId}/role`, 'changeRole'],
  ] as const)(
    'should require a valid access token for %s %s',
    async (method, path, expected) => {
      const { calls, server } = createRoutes();
      const client = request(server);

      const missing = await client[method](path).expect(401);
      expect(missing.body.error.code).toBe('AUTHENTICATION_REQUIRED');

      const invalid = await client[method](path)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      expect(invalid.body.error.code).toBe('INVALID_ACCESS_TOKEN');
      expect(calls).toEqual([]);

      await client[method](path).set('Authorization', 'Bearer admin-token').expect(204);
      expect(calls).toEqual([expected]);
    },
  );

  it('should allow staff to access their profile and revoke all of their sessions', async () => {
    const { calls, server } = createRoutes();

    await request(server)
      .get('/users/me')
      .set('Authorization', 'Bearer staff-token')
      .expect(204);

    await request(server)
      .post('/auth/logout-all')
      .set('Authorization', 'Bearer staff-token')
      .expect(204);

    expect(calls).toEqual(['profile', 'logoutAll']);
  });

  it.each([
    ['get', '/users'],
    ['patch', `/users/${adminId}/role`],
  ] as const)('should restrict %s %s to administrators', async (method, path) => {
    const { calls, server } = createRoutes();
    const client = request(server);

    const response = await client[method](path)
      .set('Authorization', 'Bearer staff-token')
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(calls).toEqual([]);
  });

  it('should reject an administrator changing their own role through the registered route', async () => {
    const { dependencies } = createRoutes();
    const changeRoleAndRevokeSessions = vi.fn();

    const useCase = new ChangeUserRoleUseCase(
      { now: () => new Date() } as Clock,
      { changeRoleAndRevokeSessions } as unknown as UsersRepository,
    );

    const controller = new ChangeUserRoleController(useCase, {
      maxBytes: 1024,
      allowEmpty: false,
    });

    const actualRouter = new Router();

    registerIdentityRoutes(actualRouter, {
      ...dependencies,
      changeUserRoleController: controller,
    });

    const response = await request(createApplicationServer(actualRouter))
      .patch(`/users/${adminId}/role`)
      .set('Authorization', 'Bearer admin-token')
      .send({ role: 'STAFF' })
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(changeRoleAndRevokeSessions).not.toHaveBeenCalled();
  });
});
