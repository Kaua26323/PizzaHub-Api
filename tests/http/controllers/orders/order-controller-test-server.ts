import type { Server } from 'node:http';

import { createApplicationServer } from '@/main/server';
import { Router } from '@/presentation/http/routes/router';
import { setAuthenticatedActor } from '@/presentation/http/request/request-context';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

export const staffActor: AuthenticatedActor = {
  id: '00000000-0000-4000-8000-000000000001',
  role: 'STAFF',
};

export const orderId = '00000000-0000-4000-8000-000000000002';
export const itemId = '00000000-0000-4000-8000-000000000003';
export const productId = '00000000-0000-4000-8000-000000000004';
export const jsonOptions = { maxBytes: 1024, allowEmpty: false };

export function orderControllerTestServer(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  handler: HttpRequestHandler,
  actor: AuthenticatedActor = staffActor,
): Server {
  const router = new Router();
  router[method](path, async (request, response) => {
    setAuthenticatedActor(request, actor);
    await handler(request, response);
  });
  return createApplicationServer(router);
}
