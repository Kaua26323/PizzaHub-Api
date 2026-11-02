import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  admin,
  api,
  database,
  expectError,
  seedCategory,
  seedProduct,
  storedNames,
} from '../helpers/product-api';

describe('DELETE /products/:productId', () => {
  it('should permanently delete an eligible product and its image', async () => {
    await seedCategory();
    const product = await seedProduct();
    const response = await api()
      .delete(`/products/${product.id}`)
      .set('Authorization', admin())
      .expect(204);
    expect(response.text).toBe('');
    expect(
      (await database().query('SELECT id FROM products WHERE id=$1', [product.id]))
        .rowCount,
    ).toBe(0);
    expect(await storedNames()).toEqual([]);
  });

  it('should preserve a product and image when real order history exists', async () => {
    await seedCategory();
    const product = await seedProduct();
    const userId = randomUUID();
    const orderId = randomUUID();
    await database().query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, 'Order owner', $2, 'test-hash', 'STAFF')`,
      [userId, `${userId}@example.test`],
    );
    await database().query(
      `INSERT INTO orders (id, table_number, created_by_user_id) VALUES ($1, 1, $2)`,
      [orderId, userId],
    );
    await database().query(
      `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity)
       VALUES ($1, $2, $3, 'Margherita', '30.00', 1)`,
      [randomUUID(), orderId, product.id],
    );
    const response = await api()
      .delete(`/products/${product.id}`)
      .set('Authorization', admin())
      .expect(409);
    expectError(response, 'PRODUCT_HAS_ORDER_HISTORY');
    expect(
      (await database().query('SELECT id FROM products WHERE id=$1', [product.id]))
        .rowCount,
    ).toBe(1);
    expect(await storedNames()).toEqual([product.imageKey]);
  });
});
