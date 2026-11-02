import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  absentId,
  admin,
  api,
  database,
  expectError,
  expectNoTemporaryFiles,
  png,
  seedCategory,
  seedProduct,
  storedNames,
  storedPath,
  webp,
} from '../helpers/product-api';

describe('PATCH /products/:productId', () => {
  it('should persist text-only changes and return an empty 204 response', async () => {
    await seedCategory();
    const product = await seedProduct();
    const response = await api()
      .patch(`/products/${product.id}`)
      .set('Authorization', admin())
      .field('name', 'Updated pizza')
      .field('price', '42.50')
      .expect(204);
    expect(response.text).toBe('');
    const result = await database().query(
      'SELECT name, price, image_key FROM products WHERE id = $1',
      [product.id],
    );
    expect(result.rows[0]).toMatchObject({
      name: 'Updated pizza',
      price: '42.50',
      image_key: product.imageKey,
    });
    expect(await storedNames()).toEqual([product.imageKey]);
  });

  it('should replace only the image and remove the previous file', async () => {
    await seedCategory();
    const product = await seedProduct();
    const response = await api()
      .patch(`/products/${product.id}`)
      .set('Authorization', admin())
      .attach('image', webp, 'replacement.webp')
      .expect(204);
    expect(response.text).toBe('');
    const result = await database().query(
      'SELECT image_key, image_mime_type FROM products WHERE id=$1',
      [product.id],
    );
    const newKey = result.rows[0].image_key as string;
    expect(newKey).not.toBe(product.imageKey);
    expect(result.rows[0].image_mime_type).toBe('image/webp');
    expect(await storedNames()).toEqual([newKey]);
    expect(await readFile(storedPath(newKey))).toEqual(webp);
    await expectNoTemporaryFiles();
  });

  it('should persist fields and image together', async () => {
    await seedCategory();
    const product = await seedProduct();
    await api()
      .patch(`/products/${product.id}`)
      .set('Authorization', admin())
      .field('description', 'New recipe')
      .attach('image', png, 'new.png')
      .expect(204);
    const result = await database().query(
      'SELECT description, image_key FROM products WHERE id=$1',
      [product.id],
    );
    expect(result.rows[0].description).toBe('New recipe');
    expect(result.rows[0].image_key).not.toBe(product.imageKey);
    expect(await storedNames()).toEqual([result.rows[0].image_key]);
  });

  it('should preserve the product and old image when a replacement has invalid fields', async () => {
    await seedCategory();
    const product = await seedProduct();
    const response = await api()
      .patch(`/products/${product.id}`)
      .set('Authorization', admin())
      .field('price', 'not-a-price')
      .attach('image', png, 'new.png')
      .expect(400);
    expectError(response, 'VALIDATION_ERROR');
    const result = await database().query('SELECT image_key FROM products WHERE id=$1', [
      product.id,
    ]);
    expect(result.rows[0].image_key).toBe(product.imageKey);
    expect(await storedNames()).toEqual([product.imageKey]);
    await expectNoTemporaryFiles();
  });

  it('should return 404 and clean a replacement for a nonexistent product', async () => {
    const response = await api()
      .patch(`/products/${absentId}`)
      .set('Authorization', admin())
      .attach('image', png, 'new.png')
      .expect(404);
    expectError(response, 'PRODUCT_NOT_FOUND');
    expect(await storedNames()).toEqual([]);
    await expectNoTemporaryFiles();
  });
});
