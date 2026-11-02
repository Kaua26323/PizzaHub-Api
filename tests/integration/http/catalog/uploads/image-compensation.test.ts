import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import {
  admin,
  api,
  createRequest,
  database,
  expectError,
  expectNoTemporaryFiles,
  png,
  seedCategory,
  seedProduct,
  storedDirectory,
  storedNames,
  storedPath,
} from '../helpers/product-api';

describe('product image compensation through HTTP', () => {
  it('should remove a finalized image when PostgreSQL rejects product creation', async () => {
    await seedCategory();
    const suffix = randomUUID().replaceAll('-', '');
    const functionName = `t115_reject_insert_${suffix}`;
    const triggerName = `t115_reject_insert_${suffix}`;
    const productName = `T115 ${suffix}`;
    try {
      await database().query(`CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'injected insert failure'; END; $$ LANGUAGE plpgsql`);
      await database().query(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON products
        FOR EACH ROW WHEN (NEW.name = '${productName}')
        EXECUTE FUNCTION ${functionName}()`);
      const response = await createRequest(productName)
        .attach('image', png, 'pizza.png')
        .expect(500);
      expectError(response, 'INTERNAL_ERROR');
      expect((await database().query('SELECT id FROM products')).rowCount).toBe(0);
      expect(await storedNames()).toEqual([]);
      await expectNoTemporaryFiles();
    } finally {
      try {
        await database().query(`DROP TRIGGER IF EXISTS ${triggerName} ON products`);
      } finally {
        await database().query(`DROP FUNCTION IF EXISTS ${functionName}()`);
      }
    }
  });

  it('should keep the old image and remove the new one when PostgreSQL rejects replacement', async () => {
    await seedCategory();
    const product = await seedProduct();
    const suffix = randomUUID().replaceAll('-', '');
    const functionName = `t115_reject_update_${suffix}`;
    const triggerName = `t115_reject_update_${suffix}`;
    try {
      await database().query(`CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'injected update failure'; END; $$ LANGUAGE plpgsql`);
      await database().query(`CREATE TRIGGER ${triggerName} BEFORE UPDATE ON products
        FOR EACH ROW WHEN (NEW.id = '${product.id}' AND OLD.image_key IS DISTINCT FROM NEW.image_key)
        EXECUTE FUNCTION ${functionName}()`);
      const response = await api()
        .patch(`/products/${product.id}`)
        .set('Authorization', admin())
        .attach('image', png, 'new.png')
        .expect(500);
      expectError(response, 'INTERNAL_ERROR');
      const result = await database().query(
        'SELECT image_key FROM products WHERE id=$1',
        [product.id],
      );
      expect(result.rows[0].image_key).toBe(product.imageKey);
      expect(await storedNames()).toEqual([product.imageKey]);
      expect(await readFile(storedPath(product.imageKey))).toEqual(product.bytes);
      await expectNoTemporaryFiles();
    } finally {
      try {
        await database().query(`DROP TRIGGER IF EXISTS ${triggerName} ON products`);
      } finally {
        await database().query(`DROP FUNCTION IF EXISTS ${functionName}()`);
      }
    }
  });

  it('should keep the product when image finalization cannot use storage', async () => {
    await seedCategory();
    const product = await seedProduct();
    const originalDirectory = storedDirectory();
    const backupDirectory = `${originalDirectory}-${randomUUID()}`;
    let moved = false;
    // A regular file at the storage directory makes mkdir fail for every user.
    try {
      await rename(originalDirectory, backupDirectory);
      moved = true;
      await writeFile(originalDirectory, 'storage unavailable', { flag: 'wx' });
      const response = await api()
        .patch(`/products/${product.id}`)
        .set('Authorization', admin())
        .attach('image', png, 'new.png')
        .expect(500);
      expectError(response, 'INTERNAL_ERROR');
    } finally {
      if (moved) {
        // Without recursive, rm cannot remove a directory or its images.
        await rm(originalDirectory, { force: true });
        await rename(backupDirectory, originalDirectory);
      }
    }
    const result = await database().query('SELECT image_key FROM products WHERE id=$1', [
      product.id,
    ]);
    expect(result.rows[0].image_key).toBe(product.imageKey);
    expect(await storedNames()).toEqual([product.imageKey]);
    expect(await readFile(storedPath(product.imageKey))).toEqual(product.bytes);
    await expectNoTemporaryFiles();
  });
});
