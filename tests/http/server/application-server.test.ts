import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApplicationServer } from '@/main/server';
import { Router } from '@/presentation/http/routes/router';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

describe('createApplicationServer', () => {
  it('should return the health status using the default router', async () => {
    const server = createApplicationServer();

    const response = await request(server).get('/health').expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        status: 'ok',
      },
      error: null,
    });
  });

  it('should return 404 for an unknown route', async () => {
    const server = createApplicationServer();

    const response = await request(server).get('/unknown').expect(404);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  it('should handle request context errors through the global error handler', async () => {
    const router = new Router();

    router.get('/products', async (_request, response) => {
      response.end('products');
    });

    const server = createApplicationServer(router);

    const response = await request(server).get('/products?name=%ZZ').expect(400);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'INVALID_QUERY_PARAMETER',
        message: 'Invalid URL encoding.',
      },
    });
  });

  it('should map application errors to the correct HTTP response', async () => {
    const router = new Router();

    router.get('/products/:productId', async () => {
      throw new ResourceNotFoundError('PRODUCT_NOT_FOUND', 'Product not found.');
    });

    const server = createApplicationServer(router);

    const response = await request(server).get('/products/123').expect(404);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found.',
      },
    });
  });

  it('should return HTTP 500 without exposing unexpected errors', async () => {
    const router = new Router();

    router.get('/failure', async () => {
      throw new Error('Database password: secret123');
    });

    const server = createApplicationServer(router);

    const response = await request(server).get('/failure').expect(500);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });

    expect(response.text).not.toContain('secret123');
  });
});
