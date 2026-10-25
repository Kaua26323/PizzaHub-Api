import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';

import request from 'supertest';
import type { Response } from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Router } from '@/presentation/http/routes/router';
import { createApplicationServer } from '@/main/server';
import { GetProductImageController } from '@/presentation/http/controllers/catalog/get-product-image-controller';

// Supertest converts some image responses to a Buffer automatically, but an
// explicit parser makes the binary assertion independent of Content-Type.
function binaryParser(
  response: Response,
  callback: (error: Error | null, body?: Buffer) => void,
): void {
  const chunks: Buffer[] = [];

  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', (error: Error) => callback(error));
}

describe('GetProductImageController', () => {
  let directory: string;
  let permanentDirectory: string;
  let server: Server;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pizzahub-image-'));
    permanentDirectory = join(directory, 'products');
    await mkdir(permanentDirectory);

    const router = new Router();
    const controller = new GetProductImageController(permanentDirectory);
    router.get('/images/products/:imageKey', controller.handler);
    server = createApplicationServer(router);
  });

  afterEach(async () => {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await rm(directory, { recursive: true, force: true });
  });

  it.each([
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['webp', 'image/webp'],
  ] as const)(
    'should deliver a %s image with its original bytes and content type',
    async (extension, mimeType) => {
      const imageKey = `${randomUUID()}.${extension}`;
      const imageBytes = Buffer.from([0, 1, 2, 3, 255, 254, 128, 4]);
      await writeFile(join(permanentDirectory, imageKey), imageBytes);

      const response = await request(server)
        .get(`/images/products/${imageKey}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      expect(response.headers['content-type']).toContain(mimeType);
      expect(Number(response.headers['content-length'])).toBe(imageBytes.length);
      expect(response.body).toEqual(imageBytes);
    },
  );

  it.each([
    'pizza.webp',
    'not-a-uuid.jpg',
    `${randomUUID()}.svg`,
    `${randomUUID()}.jpeg`,
    '00000000-0000-0000-0000-000000000000.png',
  ])('should reject an invalid image key: %s', async (imageKey) => {
    const response = await request(server)
      .get(`/images/products/${imageKey}`)
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'INVALID_ROUTE_PARAMETER',
        message: 'Invalid image key.',
      },
    });
  });

  it('should return 404 when the image does not exist', async () => {
    const imageKey = `${randomUUID()}.webp`;

    const response = await request(server)
      .get(`/images/products/${imageKey}`)
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'IMAGE_NOT_FOUND',
        message: 'Product image not found.',
      },
    });
  });

  it('should reject a directory even when its name matches the image-key format', async () => {
    const imageKey = `${randomUUID()}.png`;
    await mkdir(join(permanentDirectory, imageKey));

    const response = await request(server)
      .get(`/images/products/${imageKey}`)
      .expect(500);

    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it.skipIf(process.platform !== 'linux')(
    'should refuse a symbolic link pointing outside the image directory',
    async () => {
      // O_NOFOLLOW is used by the controller on Linux.
      expect(constants.O_NOFOLLOW).toBeDefined();
      const outsideFile = join(directory, 'outside.txt');
      await writeFile(outsideFile, 'sensitive contents');

      const imageKey = `${randomUUID()}.png`;
      await symlink(outsideFile, join(permanentDirectory, imageKey));

      const response = await request(server)
        .get(`/images/products/${imageKey}`)
        .expect(500);

      expect(response.text).not.toContain('sensitive contents');
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    },
  );
});
