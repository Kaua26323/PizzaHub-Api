import { describe, expect, it } from 'vitest';
import {
  admin,
  api,
  expectError,
  seedCategory,
  seedProduct,
  staff,
} from '../helpers/product-api';

describe('GET /images/products/:imageKey', () => {
  it.each([
    ['ADMIN', admin],
    ['STAFF', staff],
  ] as const)(
    'should deliver stored image bytes and metadata to %s',
    async (_role, token) => {
      await seedCategory();

      const product = await seedProduct();
      const response = await api()
        .get(`/images/products/${product.imageKey}`)
        .set('Authorization', token())
        .expect(200);

      expect(response.headers['content-type']).toMatch(/^image\/png/);
      expect(Number(response.headers['content-length'])).toBe(product.bytes.length);
      expect(response.body).toEqual(product.bytes);
    },
  );

  it('should return 404 for a missing image', async () => {
    const response = await api()
      .get('/images/products/00000000-0000-4000-8000-000000000000.png')
      .set('Authorization', admin())
      .expect(404);

    expectError(response, 'IMAGE_NOT_FOUND');
  });

  it.each(['bad.png', '..%2Fsecret.png'])(
    'should reject an invalid or traversal image key %s',
    async (key) => {
      const response = await api()
        .get(`/images/products/${key}`)
        .set('Authorization', admin())
        .expect(400);

      expectError(response, 'INVALID_ROUTE_PARAMETER');
    },
  );
});
