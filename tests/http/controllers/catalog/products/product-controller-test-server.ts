import type { Server } from 'node:http';

import { createApplicationServer } from '@/main/server';
import { Router } from '@/presentation/http/routes/router';
import { setAuthenticatedActor } from '@/presentation/http/request/request-context';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

export const adminActor: AuthenticatedActor = {
  id: '00000000-0000-4000-8000-000000000001',
  role: 'ADMIN',
};

export const categoryId = '00000000-0000-4000-8000-000000000002';
export const productId = '00000000-0000-4000-8000-000000000003';
export const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

export function productControllerTestServer(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  handler: HttpRequestHandler,
  actor?: AuthenticatedActor,
): Server {
  const router = new Router();
  router[method](path, async (request, response) => {
    if (actor) setAuthenticatedActor(request, actor);
    await handler(request, response);
  });
  return createApplicationServer(router);
}
