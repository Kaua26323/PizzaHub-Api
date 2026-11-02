import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { readdir, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';

import request from 'supertest';
import { expect } from 'vitest';

import { env } from '@/infrastructure/config/env';
import { makeAccessTokenProvider } from '@/infrastructure/factories/identity/make-access-token-provider';
import { createApplicationServer } from '@/main/server';
import { testPool } from '@tests/setup/postgres';

const actorId = randomUUID();
export const categoryId = randomUUID();
export const otherCategoryId = randomUUID();
export const absentId = randomUUID();

// Complete, one-pixel images. The multipart parser checks signatures; these
// fixtures also remain usable by a client that decodes the delivered bytes.
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=',
  'base64',
);
export const webp = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
  'base64',
);
export const jpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wCEAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAVEAEBAAAAAAAAAAAAAAAAAAAAAf/aAAwDAQACEAMQAAAB2gD/xAAVEAEBAAAAAAAAAAAAAAAAAAAAAf/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=',
  'base64',
);

const temporaryDirectory = env.UPLOAD_TEMP_DIRECTORY;
const permanentDirectory = env.UPLOAD_DIRECTORY;
const server: Server = createApplicationServer();
const tokens = makeAccessTokenProvider();
const [adminToken, staffToken] = await Promise.all([
  tokens.issue({ userId: actorId, role: 'ADMIN' }),
  tokens.issue({ userId: actorId, role: 'STAFF' }),
]);

export function api() {
  return request(server);
}

export function applicationServer() {
  return server;
}

export function admin() {
  return `Bearer ${adminToken}`;
}

export function staff() {
  return `Bearer ${staffToken}`;
}

export function database() {
  return testPool;
}

export function storedPath(key: string) {
  return join(permanentDirectory, key);
}

export function storedDirectory() {
  return permanentDirectory;
}

export async function storedNames() {
  return readdir(permanentDirectory);
}

export async function expectNoTemporaryFiles() {
  expect(await readdir(temporaryDirectory)).toEqual([]);
}

export async function temporaryNames() {
  return readdir(temporaryDirectory);
}

export async function seedCategory(id = categoryId) {
  await testPool.query('INSERT INTO categories (id, name) VALUES ($1, $2)', [
    id,
    `Category ${id}`,
  ]);
  return id;
}

export async function seedProduct(
  options: {
    category?: string;
    active?: boolean;
    name?: string;
    bytes?: Buffer;
  } = {},
) {
  const id = randomUUID();
  const imageKey = `${randomUUID()}.png`;
  const bytes = options.bytes ?? png;
  const category = options.category ?? categoryId;
  await writeFile(storedPath(imageKey), bytes);
  await testPool.query(
    `INSERT INTO products (id, name, description, price, image_key, image_mime_type,
      image_size, is_active, category_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      options.name ?? 'Margherita',
      'Tomato and cheese',
      '30.00',
      imageKey,
      'image/png',
      bytes.length,
      options.active ?? true,
      category,
    ],
  );
  return { id, imageKey, bytes };
}

export function createRequest(
  name = 'Margherita',
  category = categoryId,
  price = '30.00',
) {
  return api()
    .post('/products')
    .set('Authorization', admin())
    .field('name', name)
    .field('description', 'Tomato and cheese')
    .field('price', price)
    .field('categoryId', category)
    .field('isActive', 'true');
}

export function expectError(response: { body: unknown }, code: string) {
  expect(response.body).toMatchObject({
    success: false,
    data: null,
    error: { code, message: expect.any(String) },
  });
}
