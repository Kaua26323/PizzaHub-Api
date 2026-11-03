import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApplicationServer } from '@/main/server';
import { Router } from '@/presentation/http/routes/router';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { registerOrderRoutes } from '@/presentation/http/routes/order-routes';
import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import { AuthenticationError } from '@/application/errors/authentication-error';

import type { AccessTokenProvider } from '@/application/services/access-token-provider';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

const orderId = '00000000-0000-4000-8000-000000000001';
const itemId = '00000000-0000-4000-8000-000000000002';

const routes = [
  ['post', '/orders', 'create'],
  ['get', '/orders', 'list'],
  ['get', `/orders/${orderId}`, 'get'],
  ['post', `/orders/${orderId}/items`, 'add-item'],
  ['patch', `/orders/${orderId}/items/${itemId}`, 'update-item'],
  ['delete', `/orders/${orderId}/items/${itemId}`, 'remove-item'],
  ['patch', `/orders/${orderId}/submit`, 'submit'],
  ['patch', `/orders/${orderId}/complete`, 'complete'],
  ['patch', `/orders/${orderId}/cancel`, 'cancel'],
] as const;

function makeServer() {
  const calls: Array<{ name: string; actor: unknown; params: unknown }> = [];
  const handler =
    (name: string): HttpRequestHandler =>
    async (request, response) => {
      const { actor, params } = getRequestContext(request);
      calls.push({ name, actor, params });
      sendNoContent(response);
    };
  const accessTokenProvider: AccessTokenProvider = {
    issue: vi.fn(async () => 'token'),
    verify: vi.fn(async (token) => {
      if (token === 'staff' || token === 'admin') {
        return {
          userId: orderId,
          role: token === 'staff' ? ('STAFF' as const) : ('ADMIN' as const),
        };
      }
      throw new AuthenticationError('INVALID_ACCESS_TOKEN', 'Invalid access token.');
    }),
  };
  const router = new Router();
  registerOrderRoutes(router, {
    accessTokenProvider,
    createOrderController: { handler: handler('create') },
    listOrdersController: { handler: handler('list') },
    getOrderController: { handler: handler('get') },
    addOrderItemController: { handler: handler('add-item') },
    updateOrderItemController: { handler: handler('update-item') },
    removeOrderItemController: { handler: handler('remove-item') },
    submitOrderController: { handler: handler('submit') },
    completeOrderController: { handler: handler('complete') },
    cancelOrderController: { handler: handler('cancel') },
  });
  return { server: createApplicationServer(router), calls };
}

describe('registerOrderRoutes', () => {
  it.each(routes)('requires authentication for %s %s', async (method, path) => {
    const { server, calls } = makeServer();
    const response = await request(server)[method](path).expect(401);
    expect(response.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'AUTHENTICATION_REQUIRED', message: expect.any(String) },
    });
    expect(calls).toEqual([]);
  });

  it.each(['staff', 'admin'] as const)(
    'dispatches every order endpoint to its controller for %s',
    async (token) => {
      const { server, calls } = makeServer();
      for (const [method, path] of routes) {
        const client = request(server);
        await client[method](path).set('Authorization', `Bearer ${token}`).expect(204);
      }
      expect(calls.map(({ name }) => name)).toEqual(routes.map(([, , name]) => name));
      for (const call of calls) {
        expect(call.actor).toEqual({
          id: orderId,
          role: token === 'staff' ? 'STAFF' : 'ADMIN',
        });
      }
      expect(calls[4]?.params).toEqual({ orderId, itemId });
    },
  );

  it('rejects unsupported order operations with the standard route error', async () => {
    const { server, calls } = makeServer();

    const response = await request(server)
      .patch(`/orders/${orderId}`)
      .set('Authorization', 'Bearer staff')
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found' },
    });
    expect(calls).toEqual([]);
  });
});
