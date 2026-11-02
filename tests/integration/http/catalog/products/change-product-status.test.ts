import { describe, expect, it } from 'vitest';
import { admin, api, database, seedCategory, seedProduct } from '../helpers/product-api';

describe('PATCH /products/:productId/status', () => {
  it.each([
    ['activate', false, true],
    ['deactivate', true, false],
  ])(
    'should %s a product and return an empty 204 response',
    async (_label, initial, next) => {
      await seedCategory();
      const product = await seedProduct({ active: initial });
      const response = await api()
        .patch(`/products/${product.id}/status`)
        .set('Authorization', admin())
        .send({ isActive: next })
        .expect(204);
      expect(response.text).toBe('');
      const result = await database().query(
        'SELECT is_active FROM products WHERE id=$1',
        [product.id],
      );
      expect(result.rows[0].is_active).toBe(next);
    },
  );
});
