import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { ListCategoriesController } from '@/presentation/http/controllers/catalog/categories/list-categories-controller';
import type { ListCategoriesUseCase } from '@/application/use-cases/catalog/list-categories';
import {
  adminActor,
  categoryId,
  categoryControllerTestServer,
} from './category-controller-test-server';

const category = {
  id: categoryId,
  name: 'Pizza',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  updatedAt: new Date('2026-01-03T03:04:05.000Z'),
};

function makeServer(authenticated = true) {
  const execute = vi.fn(async () => [category]);

  const controller = new ListCategoriesController({
    execute,
  } as unknown as ListCategoriesUseCase);

  return {
    execute,
    server: categoryControllerTestServer(
      'get',
      '/categories',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

describe('ListCategoriesController', () => {
  it('should return multiple public categories with ISO dates in the success envelope', async () => {
    const { execute, server } = makeServer();

    const second = {
      ...category,
      id: '00000000-0000-4000-8000-000000000003',
      name: 'Drinks',
    };

    execute.mockResolvedValueOnce([category, second]);

    const response = await request(server).get('/categories').expect(200);

    expect(execute).toHaveBeenCalledExactlyOnceWith(adminActor);

    expect(response.body).toEqual({
      success: true,
      data: [category, second].map((item) => ({
        id: item.id,
        name: item.name,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      error: null,
    });

    expect(Object.keys(response.body.data[0]).sort()).toEqual([
      'createdAt',
      'id',
      'name',
      'updatedAt',
    ]);
  });

  it('should return an empty category array', async () => {
    const { execute, server } = makeServer();

    execute.mockResolvedValueOnce([]);

    const response = await request(server).get('/categories').expect(200);

    expect(response.body).toEqual({ success: true, data: [], error: null });
  });

  it('should reject a request without an authenticated actor', async () => {
    const { execute, server } = makeServer(false);

    const response = await request(server).get('/categories').expect(401);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' },
    });

    expect(execute).not.toHaveBeenCalled();
  });
});
