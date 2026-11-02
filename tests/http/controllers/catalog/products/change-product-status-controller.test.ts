import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import type { ChangeProductStatusUseCase } from '@/application/use-cases/catalog/change-product-status';
import { ChangeProductStatusController } from '@/presentation/http/controllers/catalog/products/change-product-status-controller';
import {
  adminActor,
  productControllerTestServer,
  productId,
} from './product-controller-test-server';

function makeServer(authenticated = true) {
  const execute = vi.fn(async () => undefined);
  const controller = new ChangeProductStatusController(
    { execute } as unknown as ChangeProductStatusUseCase,
    { maxBytes: 1024, allowEmpty: false },
  );

  return {
    execute,
    server: productControllerTestServer(
      'patch',
      '/products/:productId/status',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

describe('ChangeProductStatusController', () => {
  it.each([
    ['activate', true],
    ['deactivate', false],
  ])('should %s a product and return empty HTTP 204', async (_action, isActive) => {
    const { execute, server } = makeServer();

    const response = await request(server)
      .patch(`/products/${productId}/status`)
      .send({ isActive })
      .expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: adminActor,
      productId,
      isActive,
    });

    expect(response.text).toBe('');
    expect(response.body).toEqual({});
  });

  it('should reject an invalid product UUID before invoking the use case', async () => {
    const { execute, server } = makeServer();

    const response = await request(server)
      .patch('/products/not-a-uuid/status')
      .send({ isActive: true })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.' },
    });

    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'productId' })]),
    );

    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['missing isActive', {}, 'isActive'],
    ['string true', { isActive: 'true' }, 'isActive'],
    ['string false', { isActive: 'false' }, 'isActive'],
    ['number', { isActive: 1 }, 'isActive'],
    ['null', { isActive: null }, 'isActive'],
    ['unexpected property', { isActive: true, extra: 'value' }, ''],
  ])('should reject %s without invoking the use case', async (_case, body, path) => {
    const { execute, server } = makeServer();

    const response = await request(server)
      .patch(`/products/${productId}/status`)
      .send(body)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.' },
    });

    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })]),
    );

    expect(execute).not.toHaveBeenCalled();
  });

  it('should reject an empty JSON body without invoking the use case', async () => {
    const { execute, server } = makeServer();

    const response = await request(server)
      .patch(`/products/${productId}/status`)
      .set('Content-Type', 'application/json')
      .send('')
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'JSON body can not be empty.' },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', 'application/json', '{', 400, 'MALFORMED_JSON'],
    ['unsupported Content-Type', 'text/plain', 'true', 415, 'UNSUPPORTED_CONTENT_TYPE'],
  ])(
    'should reject %s without invoking the use case',
    async (_case, contentType, body, status, code) => {
      const { execute, server } = makeServer();

      const response = await request(server)
        .patch(`/products/${productId}/status`)
        .set('Content-Type', contentType)
        .send(body)
        .expect(status);

      expect(response.body).toMatchObject({
        success: false,
        data: null,
        error: { code },
      });
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('should reject an unauthenticated request before invoking the use case', async () => {
    const { execute, server } = makeServer(false);

    const response = await request(server)
      .patch(`/products/${productId}/status`)
      .send({ isActive: true })
      .expect(401);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    [new ResourceNotFoundError('PRODUCT_NOT_FOUND', 'Product not found.'), 404],
    [new AuthorizationError('FORBIDDEN'), 403],
  ])(
    'should propagate application errors through the HTTP handler',
    async (error, status) => {
      const { execute, server } = makeServer();
      execute.mockRejectedValueOnce(error);

      const response = await request(server)
        .patch(`/products/${productId}/status`)
        .send({ isActive: true })
        .expect(status);

      expect(response.body).toEqual({
        success: false,
        data: null,
        error: { code: error.code, message: error.message },
      });
      expect(execute).toHaveBeenCalledExactlyOnceWith({
        actor: adminActor,
        productId,
        isActive: true,
      });
    },
  );
});
