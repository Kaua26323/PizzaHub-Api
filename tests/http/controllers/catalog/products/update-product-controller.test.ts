import request from 'supertest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import { UpdateProductController } from '@/presentation/http/controllers/catalog/products/update-product-controller';
import type { UpdateProductUseCase } from '@/application/use-cases/catalog/update-product';
import {
  adminActor,
  productId,
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
  const temporaryFilePath = await mkdtemp(join(tmpdir(), 'pizzahub-update-product-'));
  directories.push(temporaryFilePath);
  const execute = vi.fn(async () => undefined);
  const controller = new UpdateProductController(
    { execute } as unknown as UpdateProductUseCase,
    { temporaryFilePath, maxFileSize: 1024, maxTotalBytes: 16 * 1024 },
  );

  return {
    execute,
    temporaryFilePath,
    server: productControllerTestServer(
      'patch',
      '/products/:productId',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

describe('UpdateProductController', () => {
  it('should pass normalized fields and image and return empty HTTP 204', async () => {
    const { execute, server, temporaryFilePath } = await makeServer();

    const response = await request(server)
      .patch(`/products/${productId}`)
      .field('name', '  Updated Pizza  ')
      .attach('image', png, 'replacement.png')
      .expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: adminActor,
      productId,
      changes: { name: 'Updated Pizza' },
      image: {
        key: expect.stringMatching(/^[\w-]+\.png$/),
        mimeType: 'image/png',
        size: png.length,
      },
    });
    expect(response.text).toBe('');
    expect(response.body).toEqual({});
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });

  it('should accept a fields-only update', async () => {
    const { execute, server, temporaryFilePath } = await makeServer();

    await request(server)
      .patch(`/products/${productId}`)
      .field('description', '  Updated description  ')
      .expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: adminActor,
      productId,
      changes: { description: 'Updated description' },
    });
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });

  it('should accept an image-only update and remove the temporary file', async () => {
    const { execute, server, temporaryFilePath } = await makeServer();

    await request(server)
      .patch(`/products/${productId}`)
      .attach('image', png, 'image-only.png')
      .expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: adminActor,
      productId,
      changes: {},
      image: {
        key: expect.stringMatching(/^[\w-]+\.png$/),
        mimeType: 'image/png',
        size: png.length,
      },
    });
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });

  it('should reject an empty update before invoking the use case', async () => {
    const { execute, server, temporaryFilePath } = await makeServer();

    const response = await request(server)
      .patch(`/products/${productId}`)
      .set('Content-Type', 'multipart/form-data; boundary=empty')
      .send('--empty--\r\n')
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(execute).not.toHaveBeenCalled();
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });

  it('should reject an invalid product ID before invoking the use case', async () => {
    const { execute, server, temporaryFilePath } = await makeServer();

    const response = await request(server)
      .patch('/products/not-a-uuid')
      .field('name', 'Pizza')
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(execute).not.toHaveBeenCalled();
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });

  it('should remove an uploaded image when field validation fails', async () => {
    const { execute, server, temporaryFilePath } = await makeServer();

    const response = await request(server)
      .patch(`/products/${productId}`)
      .field('name', 'P'.repeat(81))
      .attach('image', png, 'pizza.png')
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(execute).not.toHaveBeenCalled();
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });

  it('should remove an uploaded image when the use case rejects', async () => {
    const { execute, server, temporaryFilePath } = await makeServer();
    execute.mockRejectedValueOnce(new ResourceNotFoundError('PRODUCT_NOT_FOUND'));

    const response = await request(server)
      .patch(`/products/${productId}`)
      .attach('image', png, 'pizza.png')
      .expect(404);

    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
    expect(execute).toHaveBeenCalledOnce();
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });

  it('should reject an unauthenticated request before parsing multipart input', async () => {
    const { execute, server, temporaryFilePath } = await makeServer(false);

    const response = await request(server).patch(`/products/${productId}`).expect(401);

    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(execute).not.toHaveBeenCalled();
    expect(await readdir(temporaryFilePath)).toEqual([]);
  });
});
