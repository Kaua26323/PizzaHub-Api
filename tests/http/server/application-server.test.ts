import request from 'supertest';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import { createApplicationServer } from '@/main/server';
import { Router } from '@/presentation/http/routes/router';
import { jsonBodyParser } from '@/presentation/http/parsers/json-body-parser';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import { busboyMultipartParser } from '@/presentation/http/parsers/busboy-multipart-parse';

function createJsonParsingServer(maxBytes: number) {
  const router = new Router();

  router.post('/json', async (request, response) => {
    await jsonBodyParser({ request, maxBytes, allowEmpty: false });
    response.end();
  });

  return createApplicationServer(router);
}

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

  it('should return HTTP 400 for malformed JSON', async () => {
    const server = createJsonParsingServer(1024);

    const response = await request(server)
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('{"name":}')
      .expect(400);

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'MALFORMED_JSON',
        message: 'Malformed JSON body.',
      },
    });
  });

  it('should reject JSON bodies exceeding the configured limit', async () => {
    const router = new Router();
    let receivedContentLength: string | undefined;

    router.post('/json', async (request, response) => {
      receivedContentLength = request.headers['content-length'];
      await jsonBodyParser({ request, maxBytes: 8, allowEmpty: false });
      response.end();
    });

    const server = createApplicationServer(router);
    const httpRequest = request(server)
      .post('/json')
      .set('Content-Type', 'application/json');

    httpRequest.write('{"name":');
    httpRequest.write('"Pepperoni"}');

    const response = await httpRequest.expect(413);

    expect(receivedContentLength).toBeUndefined();
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'JSON body exceeds the maximum allowed size.',
      },
    });
  });

  it('should reject requests with an unsupported JSON content type', async () => {
    const server = createJsonParsingServer(1024);

    const response = await request(server)
      .post('/json')
      .set('Content-Type', 'text/plain')
      .send('{"name":"Pepperoni"}')
      .expect(415);

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: 'Invalid content type.',
      },
    });
  });

  it('should map multipart parser errors to the expected HTTP response', async () => {
    const router = new Router();

    router.post('/upload', async (request, response) => {
      await busboyMultipartParser({
        request,
        temporaryFilePath: tmpdir(),
        maxFields: 5,
        maxFileSize: 1024,
        maxTotalBytes: 16 * 1024,
      });
      response.end();
    });

    const server = createApplicationServer(router);
    const response = await request(server)
      .post('/upload')
      .set('Content-Type', 'multipart/form-data')
      .send('missing boundary')
      .expect(400);

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'INVALID_MULTIPART_BODY',
        message: 'Invalid multipart request.',
      },
    });
  });
});
