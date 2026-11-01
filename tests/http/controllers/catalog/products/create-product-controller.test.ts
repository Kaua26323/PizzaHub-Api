import request from 'supertest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import { CreateProductController } from '@/presentation/http/controllers/catalog/products/create-product-controller';
import type { CreateProductUseCase } from '@/application/use-cases/catalog/create-product';
import {
  adminActor,
  categoryId,
  png,
  productControllerTestServer,
} from './product-controller-test-server';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function makeServer(authenticated = true) {
  const temporaryFilePath = await mkdtemp(join(tmpdir(), 'pizzahub-create-product-'));
  directories.push(temporaryFilePath);
  const execute = vi.fn(async () => undefined);
  const controller = new CreateProductController(
    { execute } as unknown as CreateProductUseCase,
    { temporaryFilePath, maxFileSize: 1024, maxTotalBytes: 16 * 1024 },
  );

  return {
    execute,
    temporaryFilePath,
    server: productControllerTestServer(
      'post',
      '/products',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

function createRequest(
  server: Awaited<ReturnType<typeof makeServer>>['server'],
  name = 'Pepperoni',
) {
  return request(server)
    .post('/products')
    .field('name', name)
    .field('description', 'Pizza with pepperoni')
    .field('price', '45.90')
    .field('categoryId', categoryId)
    .field('isActive', 'true');
}

describe('CreateProductController', () => {
  it('should normalize multipart fields, pass the uploaded image, and return HTTP 201', async () => {
    const { execute, server, temporaryFilePath } = await makeServer();

    const response = await createRequest(server, '  Pepperoni  ')
      .attach('image', png, 'pizza.png')
      .expect(201);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: adminActor,
      product: {
        name: 'Pepperoni',
        description: 'Pizza with pepperoni',
        price: '45.90',
        categoryId,
        isActive: true,
      },
      image: {
        key: expect.stringMatching(/^[\w-]+\.png$/),
        mimeType: 'image/png',
        size: png.length,
      },
    });
    expect(response.body).toEqual({ success: true, data: null, error: null });
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });

  it('should reject a create without an image before invoking the use case', async () => {
    const { execute, server, temporaryFilePath } = await makeServer();

    const response = await createRequest(server).expect(400);

    expect(response.body.error.code).toBe('PRODUCT_IMAGE_REQUIRED');
    expect(execute).not.toHaveBeenCalled();
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });

  it('should reject a name longer than 80 characters and remove the uploaded file', async () => {
    const { execute, server, temporaryFilePath } = await makeServer();

    const response = await createRequest(server, 'P'.repeat(81))
      .attach('image', png, 'pizza.png')
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(execute).not.toHaveBeenCalled();
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });

  it('should remove the uploaded file when the use case rejects', async () => {
    const { execute, server, temporaryFilePath } = await makeServer();
    execute.mockRejectedValueOnce(new ResourceNotFoundError('CATEGORY_NOT_FOUND'));

    const response = await createRequest(server)
      .attach('image', png, 'pizza.png')
      .expect(404);

    expect(response.body.error.code).toBe('CATEGORY_NOT_FOUND');
    expect(execute).toHaveBeenCalledOnce();
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });

  it('should reject an unauthenticated request before parsing multipart input', async () => {
    const { execute, server, temporaryFilePath } = await makeServer(false);

    const response = await request(server).post('/products').expect(401);

    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(execute).not.toHaveBeenCalled();
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });
});
