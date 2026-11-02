import { describe, expect, it } from 'vitest';

import { presentProduct } from '@/presentation/http/presenters/product-presenter';
import type { ListedProduct } from '@/application/use-cases/catalog/list-products';

const product: ListedProduct = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Pepperoni',
  description: 'Pizza with pepperoni',
  price: '45.90',
  imageKey: '00000000-0000-4000-8000-000000000002.png',
  imageMimeType: 'image/png',
  imageSize: 12,
  categoryId: '00000000-0000-4000-8000-000000000003',
  isActive: true,
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  updatedAt: new Date('2026-01-03T03:04:05.000Z'),
};

describe('presentProduct', () => {
  it('should replace imageKey with the image delivery URL and preserve public fields', () => {
    const result = presentProduct(product);

    expect(result).toEqual({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: `/images/products/${product.imageKey}`,
      imageMimeType: product.imageMimeType,
      imageSize: product.imageSize,
      categoryId: product.categoryId,
      isActive: product.isActive,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    });

    expect(result).not.toHaveProperty('imageKey');
  });

  it('should encode the image key as a single URL path segment', () => {
    const result = presentProduct({ ...product, imageKey: 'pizza #1.png' });

    expect(result.imageUrl).toBe('/images/products/pizza%20%231.png');
  });

  it('should not mutate the Application product', () => {
    const snapshot = { ...product };

    const result = presentProduct(product);

    expect(product).toEqual(snapshot);
    expect(product.imageKey).toBe(snapshot.imageKey);
    expect(result).not.toBe(product);
  });

  it('should give each product its corresponding image URL', () => {
    const second = { ...product, imageKey: '00000000-0000-4000-8000-000000000004.webp' };

    expect([product, second].map(presentProduct).map(({ imageUrl }) => imageUrl)).toEqual(
      [`/images/products/${product.imageKey}`, `/images/products/${second.imageKey}`],
    );
  });

  it('should not expose unexpected application properties', () => {
    const input = {
      ...product,
      internalField: 'internal-value',
    };

    const result = presentProduct(input);

    expect(result).not.toHaveProperty('internalField');
  });
});
