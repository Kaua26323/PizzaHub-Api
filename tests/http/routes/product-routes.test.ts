import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApplicationServer } from '@/main/server';
import { Router } from '@/presentation/http/routes/router';
import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { registerProductRoutes } from '@/presentation/http/routes/product-routes';

import type { AccessTokenProvider } from '@/application/services/access-token-provider';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

const adminId = '00000000-0000-4000-8000-000000000001';
const staffId = '00000000-0000-4000-8000-000000000002';
const productId = '00000000-0000-4000-8000-000000000003';

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

  registerProductRoutes(router, {
    accessTokenProvider,
    listProductsController: { handler: handler('list') },
    createProductController: { handler: handler('create') },
    updateProductController: { handler: handler('update') },
    changeProductStatusController: { handler: handler('change-status') },
    deleteProductController: { handler: handler('delete') },
  });

  return { calls, verify, server: createApplicationServer(router) };
}

describe('registerProductRoutes', () => {
  it.each([
    ['get', '/products'],
    ['post', '/products'],
    ['patch', `/products/${productId}`],
    ['patch', `/products/${productId}/status`],
    ['delete', `/products/${productId}`],
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
    ['get', '/products', 'Basic admin-token', 'AUTHENTICATION_REQUIRED'],
    ['get', '/products', 'Bearer', 'AUTHENTICATION_REQUIRED'],
    ['get', '/products', 'Bearer invalid-token', 'INVALID_ACCESS_TOKEN'],
    [
      'patch',
      `/products/${productId}/status`,
      'Basic admin-token',
      'AUTHENTICATION_REQUIRED',
    ],
    ['patch', `/products/${productId}/status`, 'Bearer', 'AUTHENTICATION_REQUIRED'],
    [
      'patch',
      `/products/${productId}/status`,
      'Bearer invalid-token',
      'INVALID_ACCESS_TOKEN',
    ],
    ['delete', `/products/${productId}`, 'Basic admin-token', 'AUTHENTICATION_REQUIRED'],
    ['delete', `/products/${productId}`, 'Bearer', 'AUTHENTICATION_REQUIRED'],
    ['delete', `/products/${productId}`, 'Bearer invalid-token', 'INVALID_ACCESS_TOKEN'],
  ] as const)(
    'should reject malformed or invalid Bearer credentials for %s %s',
    async (method, path, authorization, code) => {
      const { calls, server } = makeServer();
      const client = request(server);

      const response = await client[method](path)
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
    'should let authenticated staff and admin list products',
    async (token, id, role) => {
      const { calls, server } = makeServer();

      await request(server)
        .get('/products')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(calls).toEqual([{ name: 'list', actor: { id, role }, params: {} }]);
    },
  );

  it.each([
    ['post', '/products'],
    ['patch', `/products/${productId}`],
    ['patch', `/products/${productId}/status`],
    ['delete', `/products/${productId}`],
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
    ['post', '/products', 'create', {}],
    ['patch', `/products/${productId}`, 'update', { productId }],
    ['patch', `/products/${productId}/status`, 'change-status', { productId }],
    ['delete', `/products/${productId}`, 'delete', { productId }],
  ] as const)(
    'should send authorized ADMIN requests to the registered controller',
    async (method, path, name, params) => {
      const { calls, server } = makeServer();
      const client = request(server);

      await client[method](path).set('Authorization', 'Bearer admin-token').expect(204);

      expect(calls).toEqual([{ name, actor: { id: adminId, role: 'ADMIN' }, params }]);
    },
  );

  it.each([
    ['post', `/products/${productId}/status`],
    ['delete', `/products/${productId}/status`],
    ['get', `/products/${productId}`],
  ] as const)(
    'should reject unsupported %s %s without invoking a controller',
    async (method, path) => {
      const { calls, server } = makeServer();
      const client = request(server);

      const response = await client[method](path)
        .set('Authorization', 'Bearer admin-token')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        data: null,
        error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found' },
      });
      expect(calls).toEqual([]);
    },
  );
});
