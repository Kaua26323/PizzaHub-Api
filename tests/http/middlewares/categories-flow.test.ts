import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { testPool } from '@tests/setup/postgres';
import { createApplicationServer } from '@/main/server';

const password = 'StrongPassword123!';
const absentCategoryId = '00000000-0000-4000-8000-000000000099';

type Server = ReturnType<typeof createApplicationServer>;

async function authenticatedUser(server: Server, email: string, role: 'ADMIN' | 'STAFF') {
  const registered = await request(server)
    .post('/auth/register')
    .send({ name: 'Category Tester', email, password })
    .expect(201);

  if (role === 'ADMIN') {
    await testPool.query('UPDATE users SET role = $1 WHERE id = $2', [
      role,
      registered.body.data.id,
    ]);
  }

  const loggedIn = await request(server)
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  const token: unknown = loggedIn.body.data.accessToken;
  expect(token).toEqual(expect.any(String));
  if (typeof token !== 'string') throw new Error('Expected a string access token.');
  return `Bearer ${token}`;
}

async function createCategory(server: Server, authorization: string, name: string) {
  const response = await request(server)
    .post('/categories')
    .set('Authorization', authorization)
    .send({ name })
    .expect(201);
  expect(response.body).toEqual({ success: true, data: null, error: null });
}

async function listedCategories(server: Server, authorization: string) {
  const response = await request(server)
    .get('/categories')
    .set('Authorization', authorization)
    .expect(200);
  expect(response.body).toMatchObject({ success: true, error: null });
  return response.body.data as Array<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

describe('Categories HTTP API with PostgreSQL', () => {
  it('should create, list, update, and delete a category through the complete HTTP flow', async () => {
    const server = createApplicationServer();
    const admin = await authenticatedUser(server, 'category-admin@example.com', 'ADMIN');

    await createCategory(server, admin, 'Pizza');
    const initial = await listedCategories(server, admin);
    expect(initial).toHaveLength(1);
    const created = initial[0];
    expect(created).toBeDefined();
    if (!created) throw new Error('Expected the created category.');
    expect(created.name).toBe('Pizza');
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(created).sort()).toEqual(['createdAt', 'id', 'name', 'updatedAt']);
    expect(created.createdAt).toBe(new Date(created.createdAt).toISOString());
    expect(created.updatedAt).toBe(new Date(created.updatedAt).toISOString());

    const updated = await request(server)
      .patch(`/categories/${created.id}`)
      .set('Authorization', admin)
      .send({ name: '  Drinks  ' })
      .expect(204);
    expect(updated.text).toBe('');
    expect(updated.body).toEqual({});
    expect(await listedCategories(server, admin)).toEqual([
      { ...created, name: 'Drinks', updatedAt: expect.any(String) },
    ]);

    const deleted = await request(server)
      .delete(`/categories/${created.id}`)
      .set('Authorization', admin)
      .expect(204);
    expect(deleted.text).toBe('');
    expect(deleted.body).toEqual({});
    expect(await listedCategories(server, admin)).toEqual([]);
  });

  it('should reject invalid input, duplicate names, and missing categories with defined HTTP errors', async () => {
    const server = createApplicationServer();
    const admin = await authenticatedUser(
      server,
      'validation-admin@example.com',
      'ADMIN',
    );

    for (const name of ['', '   ']) {
      const invalid = await request(server)
        .post('/categories')
        .set('Authorization', admin)
        .send({ name })
        .expect(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    }
    const extra = await request(server)
      .post('/categories')
      .set('Authorization', admin)
      .send({ name: 'Pizza', extra: true })
      .expect(400);
    expect(extra.body.error.code).toBe('VALIDATION_ERROR');

    await createCategory(server, admin, 'Pizza');
    const duplicate = await request(server)
      .post('/categories')
      .set('Authorization', admin)
      .send({ name: ' Pizza ' })
      .expect(409);
    expect(duplicate.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'CATEGORY_NAME_ALREADY_EXISTS',
        message: 'Category name already exists.',
      },
    });

    const invalidId = await request(server)
      .patch('/categories/not-a-uuid')
      .set('Authorization', admin)
      .send({ name: 'Drinks' })
      .expect(400);
    expect(invalidId.body.error.code).toBe('VALIDATION_ERROR');
    const invalidDeleteId = await request(server)
      .delete('/categories/not-a-uuid')
      .set('Authorization', admin)
      .expect(400);
    expect(invalidDeleteId.body.error.code).toBe('VALIDATION_ERROR');

    const missingUpdate = await request(server)
      .patch(`/categories/${absentCategoryId}`)
      .set('Authorization', admin)
      .send({ name: 'Drinks' })
      .expect(404);
    expect(missingUpdate.body.error.code).toBe('CATEGORY_NOT_FOUND');
    const missingDelete = await request(server)
      .delete(`/categories/${absentCategoryId}`)
      .set('Authorization', admin)
      .expect(404);
    expect(missingDelete.body.error.code).toBe('CATEGORY_NOT_FOUND');
    expect(
      (await listedCategories(server, admin)).map((category) => category.name),
    ).toEqual(['Pizza']);
  });

  it('should let STAFF list categories but prevent category changes and preserve database state', async () => {
    const server = createApplicationServer();
    const admin = await authenticatedUser(
      server,
      'permissions-admin@example.com',
      'ADMIN',
    );
    const staff = await authenticatedUser(
      server,
      'permissions-staff@example.com',
      'STAFF',
    );
    await createCategory(server, admin, 'Pizza');
    const [category] = await listedCategories(server, staff);
    expect(category?.name).toBe('Pizza');
    if (!category) throw new Error('Expected the created category.');

    const deniedCreate = await request(server)
      .post('/categories')
      .set('Authorization', staff)
      .send({ name: 'Drinks' })
      .expect(403);
    expect(deniedCreate.body.error.code).toBe('FORBIDDEN');
    const deniedUpdate = await request(server)
      .patch(`/categories/${category.id}`)
      .set('Authorization', staff)
      .send({ name: 'Drinks' })
      .expect(403);
    expect(deniedUpdate.body.error.code).toBe('FORBIDDEN');
    const deniedDelete = await request(server)
      .delete(`/categories/${category.id}`)
      .set('Authorization', staff)
      .expect(403);
    expect(deniedDelete.body.error.code).toBe('FORBIDDEN');

    const missingCredentials = await request(server).get('/categories').expect(401);
    expect(missingCredentials.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(await listedCategories(server, admin)).toEqual([category]);
  });

  it('should refuse deletion while the category is referenced by a product', async () => {
    const server = createApplicationServer();
    const admin = await authenticatedUser(server, 'product-admin@example.com', 'ADMIN');
    await createCategory(server, admin, 'Pizza');
    const [category] = await listedCategories(server, admin);
    if (!category) throw new Error('Expected the created category.');

    await testPool.query(
      `INSERT INTO products (id, name, description, price, image_key, image_mime_type, image_size, is_active, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        '00000000-0000-4000-8000-000000000004',
        'Margherita',
        'Tomato and cheese',
        '12.00',
        'category-test-image',
        'image/png',
        1,
        true,
        category.id,
      ],
    );
    const response = await request(server)
      .delete(`/categories/${category.id}`)
      .set('Authorization', admin)
      .expect(409);
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'CATEGORY_NOT_EMPTY',
        message: 'Category cannot be deleted while it has associated products.',
      },
    });
    expect(await listedCategories(server, admin)).toEqual([category]);
  });
});
