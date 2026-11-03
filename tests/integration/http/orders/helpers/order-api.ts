import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { expect } from 'vitest';

import { makeAccessTokenProvider } from '@/infrastructure/factories/identity/make-access-token-provider';
import { createApplicationServer } from '@/main/server';
import { testPool } from '@tests/setup/postgres';

const staffActorId = randomUUID();
const adminActorId = randomUUID();
const categoryId = randomUUID();
const server = createApplicationServer();
const tokens = makeAccessTokenProvider();
const [staffToken, adminToken] = await Promise.all([
  tokens.issue({ userId: staffActorId, role: 'STAFF' }),
  tokens.issue({ userId: adminActorId, role: 'ADMIN' }),
]);

export const absentId = randomUUID();

export function api() {
  return request(server);
}

export function staff() {
  return `Bearer ${staffToken}`;
}

export function admin() {
  return `Bearer ${adminToken}`;
}

export function database() {
  return testPool;
}

export function creatorId(role: 'STAFF' | 'ADMIN' = 'STAFF') {
  return role === 'STAFF' ? staffActorId : adminActorId;
}

export async function seedActor() {
  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES ($1, 'Order API staff', $2, 'hashed-password', 'STAFF'),
            ($3, 'Order API admin', $4, 'hashed-password', 'ADMIN')`,
    [
      staffActorId,
      `order-api-${staffActorId}@example.com`,
      adminActorId,
      `order-api-${adminActorId}@example.com`,
    ],
  );
}

export async function seedProduct(name = 'Calabresa', price = '49.90') {
  const id = randomUUID();
  await testPool.query('INSERT INTO categories (id, name) VALUES ($1, $2)', [
    categoryId,
    'Pizzas',
  ]);
  await testPool.query(
    `INSERT INTO products (id, name, description, price, image_key,
      image_mime_type, image_size, is_active, category_id)
     VALUES ($1, $2, 'Pizza', $3, $4, 'image/png', 1, true, $5)`,
    [id, name, price, `${id}.png`, categoryId],
  );
  return id;
}

export async function createDraft(
  tableNumber: number,
  options: { customerName?: string | null; authorization?: string } = {},
) {
  const response = await api()
    .post('/orders')
    .set('Authorization', options.authorization ?? staff())
    .send({
      tableNumber,
      ...(options.customerName !== undefined && { customerName: options.customerName }),
    })
    .expect(201);
  expect(response.body).toEqual({ success: true, data: null, error: null });

  // Creation intentionally returns no ID; the database supplies it for follow-up requests.
  const result = await testPool.query<{ id: string }>(
    'SELECT id FROM orders WHERE table_number = $1',
    [tableNumber],
  );
  expect(result.rows).toHaveLength(1);
  return result.rows[0]!.id;
}

export async function addItem(
  orderId: string,
  productId: string,
  quantity = 1,
  notes?: string | null,
) {
  const response = await api()
    .post(`/orders/${orderId}/items`)
    .set('Authorization', staff())
    .send({ productId, quantity, ...(notes !== undefined && { notes }) })
    .expect(201);
  expect(response.body).toEqual({ success: true, data: null, error: null });
  const result = await testPool.query<{ id: string }>(
    'SELECT id FROM order_items WHERE order_id = $1 ORDER BY id',
    [orderId],
  );
  return result.rows.map((row) => row.id);
}

export function expectError(response: { body: unknown }, code: string) {
  expect(response.body).toMatchObject({
    success: false,
    data: null,
    error: { code, message: expect.any(String) },
  });
}
