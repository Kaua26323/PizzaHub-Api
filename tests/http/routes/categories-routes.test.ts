import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApplicationServer } from '@/main/server';
import { Router } from '@/presentation/http/routes/router';
import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { registerCategoriesRoutes } from '@/presentation/http/routes/categories-routes';

import type { AccessTokenProvider } from '@/application/services/access-token-provider';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

const adminId = '00000000-0000-4000-8000-000000000001';
const staffId = '00000000-0000-4000-8000-000000000002';
const categoryId = '00000000-0000-4000-8000-000000000003';

function makeServer() {
  const calls: Array<{
    name: string;
    actor: unknown;
    params: Readonly<Record<string, string>>;
  }> = [];

  const handler =
    (name: string): HttpRequestHandler =>
    async (incoming, response) => {
      const { actor, params } = getRequestContext(incoming);
      calls.push({ name, actor, params });
      sendNoContent(response);
    };

  const verify = vi.fn(async (token: string) => {
    if (token === 'admin-token') return { userId: adminId, role: 'ADMIN' as const };
    if (token === 'staff-token') return { userId: staffId, role: 'STAFF' as const };
    throw new AuthenticationError('INVALID_ACCESS_TOKEN', 'Invalid access token.');
  });

  const accessTokenProvider: AccessTokenProvider = {
    issue: vi.fn(async () => 'token'),
    verify,
  };

  const router = new Router();

  registerCategoriesRoutes(router, {
    accessTokenProvider,
    listCategoriesController: { handler: handler('list') },
    createCategoryController: { handler: handler('create') },
    updateCategoryController: { handler: handler('update') },
    deleteCategoryController: { handler: handler('delete') },
  });

  return { calls, verify, server: createApplicationServer(router) };
}

describe('registerCategoriesRoutes', () => {
  it.each([
    ['get', '/categories'],
    ['post', '/categories'],
    ['patch', `/categories/${categoryId}`],
    ['delete', `/categories/${categoryId}`],
  ] as const)(
    'should reject unauthenticated %s %s without invoking a controller',
    async (method, path) => {
      const { calls, verify, server } = makeServer();

      const response = await request(server)[method](path).expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      expect(calls).toEqual([]);
      expect(verify).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['Basic admin-token', 'AUTHENTICATION_REQUIRED'],
    ['Bearer', 'AUTHENTICATION_REQUIRED'],
    ['Bearer invalid-token', 'INVALID_ACCESS_TOKEN'],
  ])(
    'should reject malformed or invalid Bearer credentials',
    async (authorization, code) => {
      const { calls, server } = makeServer();

      const response = await request(server)
        .get('/categories')
        .set('Authorization', authorization)
        .expect(401);

      expect(response.body.error.code).toBe(code);
      expect(calls).toEqual([]);
    },
  );

  it.each([
    ['staff-token', staffId, 'STAFF'],
    ['admin-token', adminId, 'ADMIN'],
  ] as const)(
    'should let authenticated staff and admin list categories',
    async (token, id, role) => {
      const { calls, server } = makeServer();

      await request(server)
        .get('/categories')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(calls).toEqual([{ name: 'list', actor: { id, role }, params: {} }]);
    },
  );

  it.each([
    ['post', '/categories'],
    ['patch', `/categories/${categoryId}`],
    ['delete', `/categories/${categoryId}`],
  ] as const)(
    'should deny STAFF %s %s before invoking a controller',
    async (method, path) => {
      const { calls, server } = makeServer();

      const client = request(server);

      const response = await client[method](path)
        .set('Authorization', 'Bearer staff-token')
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(calls).toEqual([]);
    },
  );

  it.each([
    ['post', '/categories', 'create', {}],
    ['patch', `/categories/${categoryId}`, 'update', { categoryId }],
    ['delete', `/categories/${categoryId}`, 'delete', { categoryId }],
  ] as const)(
    'should send authorized ADMIN requests to the registered controller',
    async (method, path, name, params) => {
      const { calls, server } = makeServer();
      const client = request(server);
      await client[method](path).set('Authorization', 'Bearer admin-token').expect(204);
      expect(calls).toEqual([{ name, actor: { id: adminId, role: 'ADMIN' }, params }]);
    },
  );
});
