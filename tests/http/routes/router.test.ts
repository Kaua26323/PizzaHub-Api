import type { IncomingMessage, ServerResponse } from 'node:http';

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Router } from '@/presentation/http/routes/router';
import { createHttpServer } from '@/presentation/http/server/create-http-server';
import {
  getRequestContext,
  RequestContextError,
} from '@/presentation/http/request/request-context';

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it('should match a static route', async () => {
    router.get('/health', async (_request, response) => {
      response.statusCode = 200;
      response.end('health');
    });

    const server = createHttpServer(router.handle);

    await request(server).get('/health').expect(200).expect('health');
  });

  it('should match a parameterized route', async () => {
    router.get('/products/:productId', async (_request, response) => {
      response.statusCode = 200;
      response.end('product');
    });

    const server = createHttpServer(router.handle);

    await request(server).get('/products/123').expect(200).expect('product');
  });

  it('should prefer a static route over a parameterized route', async () => {
    router.get('/products/:productId', async (_request, response) => {
      response.end('parameterized');
    });

    router.get('/products/latest', async (_request, response) => {
      response.end('static');
    });

    const server = createHttpServer(router.handle);

    await request(server).get('/products/latest').expect(200).expect('static');
  });

  it('should include the HTTP method when matching routes', async () => {
    router.get('/products', async (_request, response) => {
      response.end('get');
    });

    router.post('/products', async (_request, response) => {
      response.end('post');
    });

    const server = createHttpServer(router.handle);

    await request(server).get('/products').expect(200).expect('get');
    await request(server).post('/products').expect(200).expect('post');
  });

  it('should not match a parameterized route with a different path structure', async () => {
    router.get('/products/:productId', async (_request, response) => {
      response.end('product');
    });

    const server = createHttpServer(router.handle);

    const response = await request(server).get('/products/123/details');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  it('should return the standard not-found response for an unsupported route', async () => {
    const server = createHttpServer(router.handle);

    const response = await request(server).get('/unknown');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  it('should not match a route with a different HTTP method', async () => {
    router.get('/health', async (_request, response) => {
      response.end('ok');
    });

    const server = createHttpServer(router.handle);
    const response = await request(server).post('/health');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('should ignore query parameters when matching routes', async () => {
    router.get('/products/:productId', async (_request, response) => {
      response.end('product');
    });

    const server = createHttpServer(router.handle);

    await request(server).get('/products/123?active=true').expect(200).expect('product');
  });

  it('should make route and query parameters available through request context', async () => {
    router.get('/products/:productId', async (request, response) => {
      const context = getRequestContext(request);

      response.setHeader('content-type', 'application/json');

      response.end(
        JSON.stringify({
          productId: context.params.productId,
          active: context.query.get('active'),
        }),
      );
    });

    const server = createHttpServer(router.handle);

    const response = await request(server)
      .get('/products/pizza%20grande?active=true')
      .expect(200);

    expect(response.body).toEqual({
      productId: 'pizza grande',
      active: 'true',
    });
  });

  it('should propagate errors from invalid query encoding', async () => {
    router.get('/products', async (_request, response) => {
      response.end('products');
    });

    const httpRequest = {
      method: 'GET',
      url: '/products?name=%ZZ',
    } as IncomingMessage;

    const httpResponse = {
      end: vi.fn(),
    } as unknown as ServerResponse;

    await expect(router.handle(httpRequest, httpResponse)).rejects.toMatchObject({
      code: 'INVALID_QUERY_PARAMETER',
      message: 'Invalid URL encoding.',
    });

    expect(httpResponse.end).not.toHaveBeenCalled();
  });

  it('should propagate errors thrown by route handlers', async () => {
    const expectedError = new Error('Unexpected controller failure');

    router.get('/products', () => {
      throw expectedError;
    });

    const httpRequest = {
      method: 'GET',
      url: '/products',
    } as IncomingMessage;

    const httpResponse = {
      end: vi.fn(),
    } as unknown as ServerResponse;

    await expect(router.handle(httpRequest, httpResponse)).rejects.toBe(expectedError);

    expect(httpResponse.end).not.toHaveBeenCalled();
  });
});
