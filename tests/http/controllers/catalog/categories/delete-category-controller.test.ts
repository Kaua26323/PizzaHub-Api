import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import { DeleteCategoryController } from '@/presentation/http/controllers/catalog/categories/delete-category-controller';
import type { DeleteCategoryUseCase } from '@/application/use-cases/catalog/delete-category';
import {
  adminActor,
  categoryControllerTestServer,
  categoryId,
} from './category-controller-test-server';

function makeServer(authenticated = true) {
  const execute = vi.fn(async () => undefined);
  const controller = new DeleteCategoryController({
    execute,
  } as unknown as DeleteCategoryUseCase);
  return {
    execute,
    server: categoryControllerTestServer(
      'delete',
      '/categories/:categoryId',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

describe('DeleteCategoryController', () => {
  it('should pass the actor and category ID and return empty HTTP 204', async () => {
    const { execute, server } = makeServer();

    const response = await request(server)
      .delete(`/categories/${categoryId}`)
      .expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({ actor: adminActor, categoryId });
    expect(response.text).toBe('');
    expect(response.body).toEqual({});
  });

  it('should reject an invalid UUID without invoking the use case', async () => {
    const { execute, server } = makeServer();

    const response = await request(server).delete('/categories/not-a-uuid').expect(400);

    expect(response.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.' },
    });

    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'categoryId' })]),
    );

    expect(execute).not.toHaveBeenCalled();
  });

  it('should reject an unauthenticated request before invoking the use case', async () => {
    const { execute, server } = makeServer(false);

    const response = await request(server)
      .delete(`/categories/${categoryId}`)
      .expect(401);

    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    [
      new ResourceNotFoundError('CATEGORY_NOT_FOUND', 'Category not found.'),
      404,
      'CATEGORY_NOT_FOUND',
    ],
    [
      new ConflictError(
        'CATEGORY_NOT_EMPTY',
        'Category cannot be deleted while it has associated products.',
      ),
      409,
      'CATEGORY_NOT_EMPTY',
    ],
  ])(
    'should propagate application errors through the HTTP handler',
    async (error, status, code) => {
      const { execute, server } = makeServer();

      execute.mockRejectedValueOnce(error);

      const response = await request(server)
        .delete(`/categories/${categoryId}`)
        .expect(status);

      expect(response.body).toMatchObject({
        success: false,
        data: null,
        error: { code },
      });
    },
  );
});
