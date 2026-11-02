import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import { UpdateCategoryController } from '@/presentation/http/controllers/catalog/categories/update-category-controller';
import type { UpdateCategoryUseCase } from '@/application/use-cases/catalog/update-category';
import {
  adminActor,
  categoryId,
  categoryControllerTestServer,
} from './category-controller-test-server';

function makeServer(authenticated = true) {
  const execute = vi.fn(async () => undefined);

  const controller = new UpdateCategoryController(
    { execute } as unknown as UpdateCategoryUseCase,
    { maxBytes: 1024, allowEmpty: false },
  );

  return {
    execute,
    server: categoryControllerTestServer(
      'patch',
      '/categories/:categoryId',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

describe('UpdateCategoryController', () => {
  it('should pass the actor, ID, and normalized name and return empty HTTP 204', async () => {
    const { execute, server } = makeServer();

    const response = await request(server)
      .patch(`/categories/${categoryId}`)
      .send({ name: '  Drinks  ' })
      .expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: adminActor,
      categoryId,
      categoryName: 'Drinks',
    });

    expect(response.text).toBe('');
    expect(response.body).toEqual({});
  });

  it.each([
    ['/categories/not-a-uuid', { name: 'Drinks' }, 'categoryId'],
    [`/categories/${categoryId}`, {}, 'name'],
    [`/categories/${categoryId}`, { name: 42 }, 'name'],
    [`/categories/${categoryId}`, { name: '' }, 'name'],
    [`/categories/${categoryId}`, { name: '   ' }, 'name'],
    [`/categories/${categoryId}`, { name: 'Drinks', extra: true }, ''],
  ])(
    'should reject invalid route or body input without invoking the use case',
    async (path, body, detailPath) => {
      const { execute, server } = makeServer();
      const response = await request(server).patch(path).send(body).expect(400);

      expect(response.body).toMatchObject({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.' },
      });

      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: detailPath })]),
      );

      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('should reject an unauthenticated request before invoking the use case', async () => {
    const { execute, server } = makeServer(false);

    const response = await request(server)
      .patch(`/categories/${categoryId}`)
      .send({ name: 'Drinks' })
      .expect(401);

    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    [new ResourceNotFoundError('CATEGORY_NOT_FOUND'), 404, 'CATEGORY_NOT_FOUND'],
    [
      new ConflictError('CATEGORY_NAME_ALREADY_EXISTS', 'Category name already exists.'),
      409,
      'CATEGORY_NAME_ALREADY_EXISTS',
    ],
  ])(
    'should propagate application errors through the HTTP handler',
    async (error, status, code) => {
      const { execute, server } = makeServer();

      execute.mockRejectedValueOnce(error);

      const response = await request(server)
        .patch(`/categories/${categoryId}`)
        .send({ name: 'Drinks' })
        .expect(status);

      expect(response.body).toMatchObject({
        success: false,
        data: null,
        error: { code },
      });
    },
  );
});
