import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError } from '@/application/errors/conflict-error';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import { DeleteProductController } from '@/presentation/http/controllers/catalog/products/delete-product-controller';

import type { DeleteProductUseCase } from '@/application/use-cases/catalog/delete-product';

import {
  productId,
  adminActor,
  productControllerTestServer,
} from './product-controller-test-server';

function makeServer(authenticated = true) {
  const execute = vi.fn(async () => undefined);
  const controller = new DeleteProductController({
    execute,
  } as unknown as DeleteProductUseCase);

  return {
    execute,
    server: productControllerTestServer(
      'delete',
      '/products/:productId',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

describe('DeleteProductController', () => {
  it('should pass the actor and product ID and return empty HTTP 204', async () => {
    const { execute, server } = makeServer();

    const response = await request(server).delete(`/products/${productId}`).expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({ actor: adminActor, productId });
    expect(response.text).toBe('');
    expect(response.body).toEqual({});
  });

  it('should reject an invalid product UUID before invoking the use case', async () => {
    const { execute, server } = makeServer();

    const response = await request(server).delete('/products/not-a-uuid').expect(400);

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

  it('should reject an unauthenticated request before invoking the use case', async () => {
    const { execute, server } = makeServer(false);

    const response = await request(server).delete(`/products/${productId}`).expect(401);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    [new ResourceNotFoundError('PRODUCT_NOT_FOUND', 'Product not found.'), 404],
    [
      new ConflictError(
        'PRODUCT_HAS_ORDER_HISTORY',
        'Product with order history cannot be deleted.',
      ),
      409,
    ],
    [new AuthorizationError('FORBIDDEN'), 403],
  ])(
    'should propagate application errors through the HTTP handler',
    async (error, status) => {
      const { execute, server } = makeServer();
      execute.mockRejectedValueOnce(error);

      const response = await request(server)
        .delete(`/products/${productId}`)
        .expect(status);

      expect(response.body).toEqual({
        success: false,
        data: null,
        error: { code: error.code, message: error.message },
      });
      expect(execute).toHaveBeenCalledExactlyOnceWith({ actor: adminActor, productId });
    },
  );
});
