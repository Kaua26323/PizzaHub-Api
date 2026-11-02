import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { ListProductsController } from '@/presentation/http/controllers/catalog/products/list-products-controller';
import type {
  ListProductsUseCase,
  ListedProduct,
} from '@/application/use-cases/catalog/list-products';
import {
  adminActor,
  categoryId,
  productId,
  productControllerTestServer,
} from './product-controller-test-server';

const product: ListedProduct = {
  id: productId,
  name: 'Pepperoni',
  description: 'Pizza with pepperoni',
  price: '45.90',
  imageKey: '00000000-0000-4000-8000-000000000004.png',
  imageMimeType: 'image/png',
  imageSize: 12,
  categoryId,
  isActive: true,
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  updatedAt: new Date('2026-01-03T03:04:05.000Z'),
};

function makeServer(authenticated = true) {
  const execute = vi.fn(async () => [product]);
  const controller = new ListProductsController({
    execute,
  } as unknown as ListProductsUseCase);

  return {
    execute,
    server: productControllerTestServer(
      'get',
      '/products',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

describe('ListProductsController', () => {
  it('should list products in the success envelope with ISO dates', async () => {
    const { execute, server } = makeServer();

    const response = await request(server).get('/products').expect(200);

    expect(execute).toHaveBeenCalledExactlyOnceWith({ actor: adminActor });
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          imageUrl: `/images/products/${product.imageKey}`,
          imageMimeType: product.imageMimeType,
          imageSize: product.imageSize,
          categoryId: product.categoryId,
          isActive: product.isActive,
          createdAt: product.createdAt.toISOString(),
          updatedAt: product.updatedAt.toISOString(),
        },
      ],
      error: null,
    });
  });

  it('should pass a category filter to the use case', async () => {
    const { execute, server } = makeServer();

    await request(server).get(`/products?categoryId=${categoryId}`).expect(200);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: adminActor,
      filters: { categoryId },
    });
  });

  it('should return an empty product array', async () => {
    const { execute, server } = makeServer();
    execute.mockResolvedValueOnce([]);

    const response = await request(server).get('/products').expect(200);

    expect(response.body).toEqual({ success: true, data: [], error: null });
  });

  it.each([
    '/products?categoryId=not-a-uuid',
    `/products?categoryId=${categoryId}&categoryId=${categoryId}`,
    '/products?unexpected=value',
  ])(
    'should reject invalid product query input before invoking the use case',
    async (path) => {
      const { execute, server } = makeServer();

      const response = await request(server).get(path).expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('should reject a request without an authenticated actor', async () => {
    const { execute, server } = makeServer(false);

    const response = await request(server).get('/products').expect(401);

    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(execute).not.toHaveBeenCalled();
  });
});
