import { describe, expect, it } from 'vitest';
import {
  admin,
  api,
  categoryId,
  otherCategoryId,
  seedCategory,
  seedProduct,
  staff,
} from '../helpers/product-api';

describe('GET /products', () => {
  it.each([
    ['ADMIN', admin],
    ['STAFF', staff],
  ] as const)(
    'should list products for %s using the public presenter',
    async (_role, token) => {
      await seedCategory();
      const product = await seedProduct();
      const response = await api()
        .get('/products')
        .set('Authorization', token())
        .expect(200);
      expect(response.body).toMatchObject({
        success: true,
        error: null,
        data: [
          {
            id: product.id,
            name: 'Margherita',
            price: '30.00',
            categoryId,
            imageUrl: `/images/products/${product.imageKey}`,
            imageMimeType: 'image/png',
            imageSize: product.bytes.length,
            isActive: true,
          },
        ],
      });
      expect(response.body.data[0]).not.toHaveProperty('imageKey');
      expect(response.body.data[0].createdAt).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
      expect(response.body.data[0].updatedAt).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
    },
  );

  it('should filter products by category', async () => {
    await seedCategory();
    await seedCategory(otherCategoryId);
    const included = await seedProduct();
    await seedProduct({ category: otherCategoryId });
    const response = await api()
      .get(`/products?categoryId=${categoryId}`)
      .set('Authorization', admin())
      .expect(200);
    expect(response.body.data.map((item: { id: string }) => item.id)).toEqual([
      included.id,
    ]);
  });
});
