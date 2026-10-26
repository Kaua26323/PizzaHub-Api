import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';

import request from 'supertest';
import type { Response } from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApplicationServer } from '@/main/server';
import { Router } from '@/presentation/http/routes/router';
import { registerImageRoutes } from '@/presentation/http/routes/image-router';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { GetProductImageController } from '@/presentation/http/controllers/catalog/get-product-image-controller';

import type {
  AccessTokenClaims,
  AccessTokenProvider,
} from '@/application/services/access-token-provider';

function binaryParser(
  response: Response,
  callback: (error: Error | null, body?: Buffer) => void,
): void {
  const chunks: Buffer[] = [];

  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', (error: Error) => callback(error));
}

const admin: AccessTokenClaims = {
  userId: '00000000-0000-4000-8000-000000000001',
  role: 'ADMIN',
};

const staff: AccessTokenClaims = {
  userId: '00000000-0000-4000-8000-000000000002',
  role: 'STAFF',
};

describe('registerImageRoutes', () => {
  let directory: string;
  let server: Server;
  let imageKey: string;
  let imageBytes: Buffer;
  let accessTokenProvider: AccessTokenProvider;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pizzahub-image-route-'));
    const permanentDirectory = join(directory, 'products');
    await mkdir(permanentDirectory);

    imageKey = `${randomUUID()}.webp`;
    imageBytes = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0xff]);
    await writeFile(join(permanentDirectory, imageKey), imageBytes);

    accessTokenProvider = {
      issue: vi.fn(async () => 'unused-token'),
      verify: vi.fn(async (token: string) => {
        if (token === 'admin-token') return admin;
        if (token === 'staff-token') return staff;

        throw new AuthenticationError('INVALID_ACCESS_TOKEN', 'Invalid access token.');
      }),
    };

    const router = new Router();
    registerImageRoutes(router, {
      allowedRoles: ['ADMIN'],
      accessTokenProvider: accessTokenProvider,
      getProductImageController: new GetProductImageController(permanentDirectory),
    });

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

  it('should reject image requests without an access token', async () => {
    const response = await request(server)
      .get(`/images/products/${imageKey}`)
      .expect(401);

    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(accessTokenProvider.verify).not.toHaveBeenCalled();
  });

  it('should reject image requests with an invalid access token', async () => {
    const response = await request(server)
      .get(`/images/products/${imageKey}`)
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_ACCESS_TOKEN');
    expect(accessTokenProvider.verify).toHaveBeenCalledExactlyOnceWith('invalid-token');
  });

  it('should reject authenticated users without an allowed role', async () => {
    const response = await request(server)
      .get(`/images/products/${imageKey}`)
      .set('Authorization', 'Bearer staff-token')
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('should deliver the image to users with an allowed role', async () => {
    const response = await request(server)
      .get(`/images/products/${imageKey}`)
      .set('Authorization', 'Bearer admin-token')
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(response.headers['content-type']).toContain('image/webp');
    expect(Number(response.headers['content-length'])).toBe(imageBytes.length);
    expect(response.body).toEqual(imageBytes);
    expect(accessTokenProvider.verify).toHaveBeenCalledExactlyOnceWith('admin-token');
  });
});

describe('application image route registration', () => {
  it('should register the protected image route in the default application router', async () => {
    const server = createApplicationServer();
    const imageKey = `${randomUUID()}.webp`;

    try {
      const response = await request(server)
        .get(`/images/products/${imageKey}`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    } finally {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    }
  });
});
