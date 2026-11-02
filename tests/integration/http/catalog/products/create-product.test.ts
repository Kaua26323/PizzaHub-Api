import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  categoryId,
  createRequest,
  database,
  expectError,
  expectNoTemporaryFiles,
  png,
  seedCategory,
  storedNames,
  storedPath,
} from '../helpers/product-api';

describe('POST /products', () => {
  it('should create and persist a product and finalize its image', async () => {
    await seedCategory();

    const response = await createRequest().attach('image', png, 'pizza.png').expect(201);

    expect(response.body).toEqual({ success: true, data: null, error: null });
    const result = await database().query('SELECT * FROM products');
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]).toMatchObject({
      name: 'Margherita',
      description: 'Tomato and cheese',
      price: '30.00',
      category_id: categoryId,
      is_active: true,
      image_mime_type: 'image/png',
      image_size: png.length,
    });
    expect(await readFile(storedPath(result.rows[0].image_key))).toEqual(png);
    expect(await storedNames()).toEqual([result.rows[0].image_key]);
    await expectNoTemporaryFiles();
  });

  it('should accept a name of exactly 80 characters', async () => {
    await seedCategory();
    await createRequest('P'.repeat(80)).attach('image', png, 'pizza.png').expect(201);
    const result = await database().query('SELECT name FROM products');
    expect(result.rows[0].name).toHaveLength(80);
  });

  it('should reject a missing image without creating a product', async () => {
    await seedCategory();
    const response = await createRequest().expect(400);
    expectError(response, 'PRODUCT_IMAGE_REQUIRED');
    expect((await database().query('SELECT id FROM products')).rowCount).toBe(0);
    expect(await storedNames()).toEqual([]);
    await expectNoTemporaryFiles();
  });

  it('should reject a name longer than 80 characters and clean the upload', async () => {
    await seedCategory();
    const response = await createRequest('P'.repeat(81))
      .attach('image', png, 'pizza.png')
      .expect(400);
    expectError(response, 'VALIDATION_ERROR');
    expect((await database().query('SELECT id FROM products')).rowCount).toBe(0);
    expect(await storedNames()).toEqual([]);
    await expectNoTemporaryFiles();
  });

  it('should reject a zero price by the domain rule and remove the upload', async () => {
    await seedCategory();
    const response = await createRequest('Margherita', categoryId, '0.00')
      .attach('image', png, 'pizza.png')
      .expect(400);
    expectError(response, 'VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Money must be a valid USD amount.');
    expect((await database().query('SELECT id FROM products')).rowCount).toBe(0);
    expect(await storedNames()).toEqual([]);
    await expectNoTemporaryFiles();
  });

  it('should reject a nonexistent category and remove the uploaded image', async () => {
    const response = await createRequest().attach('image', png, 'pizza.png').expect(404);
    expectError(response, 'CATEGORY_NOT_FOUND');
    expect((await database().query('SELECT id FROM products')).rowCount).toBe(0);
    expect(await storedNames()).toEqual([]);
    await expectNoTemporaryFiles();
  });
});
