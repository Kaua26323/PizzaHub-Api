import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError } from '@/application/errors/conflict-error';
import { CreateCategoryController } from '@/presentation/http/controllers/catalog/categories/create-category-controller';
import type { CreateCategoryUseCase } from '@/application/use-cases/catalog/create-category';
import {
  adminActor,
  categoryControllerTestServer,
} from './category-controller-test-server';

function makeServer(authenticated = true) {
  const execute = vi.fn(async () => undefined);

  const controller = new CreateCategoryController(
    { execute } as unknown as CreateCategoryUseCase,
    { maxBytes: 1024, allowEmpty: false },
  );

  return {
    execute,
    server: categoryControllerTestServer(
      'post',
      '/categories',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

describe('CreateCategoryController', () => {
  it('should create a category with normalized name and return HTTP 201', async () => {
    const { execute, server } = makeServer();

    const response = await request(server)
      .post('/categories')
      .send({ name: '  Pizza  ' })
      .expect(201);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: adminActor,
      categoryName: 'Pizza',
    });

    expect(response.body).toEqual({ success: true, data: null, error: null });
  });

  it('should reject an unauthenticated request before invoking the use case', async () => {
    const { execute, server } = makeServer(false);

    const response = await request(server)
      .post('/categories')
      .send({ name: 'Pizza' })
      .expect(401);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' },
    });

    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 'name'],
    [{ name: '' }, 'name'],
    [{ name: '   ' }, 'name'],
    [{ name: 42 }, 'name'],
    [{ name: 'Pizza', extra: true }, ''],
  ])(
    'should reject invalid category input without invoking the use case',
    async (body, path) => {
      const { execute, server } = makeServer();
      const response = await request(server).post('/categories').send(body).expect(400);

      expect(response.body).toMatchObject({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.' },
      });

      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path })]),
      );

      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['application/json', '{', 400, 'MALFORMED_JSON'],
    ['text/plain', 'Pizza', 415, 'UNSUPPORTED_CONTENT_TYPE'],
  ])(
    'should reject malformed JSON or unsupported content type',
    async (contentType, body, status, code) => {
      const { execute, server } = makeServer();
      const response = await request(server)
        .post('/categories')
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

  it('should propagate a category name conflict through the HTTP error handler', async () => {
    const { execute, server } = makeServer();
    execute.mockRejectedValueOnce(
      new ConflictError('CATEGORY_NAME_ALREADY_EXISTS', 'Category name already exists.'),
    );
    const response = await request(server)
      .post('/categories')
      .send({ name: 'Pizza' })
      .expect(409);
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'CATEGORY_NAME_ALREADY_EXISTS',
        message: 'Category name already exists.',
      },
    });
  });
});
