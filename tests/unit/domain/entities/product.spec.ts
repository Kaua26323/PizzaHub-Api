import { afterEach, describe, expect, it, vi } from 'vitest';

import { Product } from '@/domain/entities/product';
import { InvalidMoneyError } from '@/domain/errors/invalid-money-error';
import { InvalidProductError } from '@/domain/errors/invalid-product-error';
import type { ImageMimeTypeProps, ProductProps } from '@/domain/entities/product';

function makeProductProps(overrides: Partial<ProductProps> = {}): ProductProps {
  return {
    id: 'product-id',
    name: 'Four-cheese pizza',
    description: 'A good pizza',
    price: '80.00',
    imageKey: 'dadnadjasn-132112312as',
    imageMimeType: 'image/png',
    imageSize: 5_000,
    categoryId: 'pizza-id',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('Domain Product (unit)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create a Product successfully', () => {
    const productProps = makeProductProps();
    const product = new Product(productProps);

    expect(product.id).toBe(productProps.id);
    expect(product.name).toBe(productProps.name);
    expect(product.description).toBe(productProps.description);
    expect(product.price).toBe(productProps.price);
    expect(product.imageKey).toBe(productProps.imageKey);
    expect(product.imageMimeType).toBe(productProps.imageMimeType);
    expect(product.imageSize).toBe(productProps.imageSize);
    expect(product.categoryId).toBe(productProps.categoryId);
    expect(product.isActive).toBe(productProps.isActive);
    expect(product.createdAt).toStrictEqual(productProps.createdAt);
    expect(product.updatedAt).toStrictEqual(productProps.updatedAt);
  });

  it('should normalize the product name', () => {
    const product = new Product(makeProductProps({ name: ' Chips ' }));
    expect(product.name).toBe('Chips');
  });

  it('should normalize the product description', () => {
    const product = new Product(makeProductProps({ description: ' The best food ' }));
    expect(product.description).toBe('The best food');
  });

  it('should accept a description with 500 characters', () => {
    const product = new Product(
      makeProductProps({
        description: 'a'.repeat(500),
      }),
    );

    expect(product.description).toHaveLength(500);
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'] as const)(
    'should accept "%s" as imageMimeType',
    (imageMimeType) => {
      const product = new Product(makeProductProps({ imageMimeType }));

      expect(product.imageMimeType).toBe(imageMimeType);
    },
  );

  it('should change the product name', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps());
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    product.changeName(' X-Egg ');

    expect(product.name).toBe('X-Egg');
    expect(product.updatedAt).toStrictEqual(new Date('2026-01-01T10:00:00.000Z'));
  });

  it('should change the product description', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps());
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    product.changeDescription(' The best pizza ');

    expect(product.description).toBe('The best pizza');
    expect(product.updatedAt).toStrictEqual(new Date('2026-01-01T10:00:00.000Z'));
  });

  it('should change the product image', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps());
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    product.changeImage('new-image-key', 'image/webp', 2_000);

    expect(product.imageKey).toBe('new-image-key');
    expect(product.imageMimeType).toBe('image/webp');
    expect(product.imageSize).toBe(2_000);
    expect(product.updatedAt).toStrictEqual(new Date('2026-01-01T10:00:00.000Z'));
  });

  it('should change the product price', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps());
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    product.changePrice('50.00');

    expect(product.price).toBe('50.00');
    expect(product.updatedAt).toStrictEqual(new Date('2026-01-01T10:00:00.000Z'));
  });

  it('should change the product category', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps());
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    product.changeCategory('new-category');

    expect(product.categoryId).toBe('new-category');
    expect(product.updatedAt).toStrictEqual(new Date('2026-01-01T10:00:00.000Z'));
  });

  it('should deactivate a product', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps());
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    product.deactivate();

    expect(product.isActive).toBe(false);
    expect(product.updatedAt).toStrictEqual(new Date('2026-01-01T10:00:00.000Z'));
  });

  it('should activate a product', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps({ isActive: false }));
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    product.activate();

    expect(product.isActive).toBe(true);
    expect(product.updatedAt).toStrictEqual(new Date('2026-01-01T10:00:00.000Z'));
  });

  it('should not update updatedAt when activating an already active product', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps({ isActive: true }));
    expect(product.isActive).toBe(true);

    const previousUpdatedAt = product.updatedAt;
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));

    product.activate();
    expect(product.isActive).toBe(true);
    expect(product.updatedAt).toStrictEqual(previousUpdatedAt);
  });

  it('should not update updatedAt when deactivating an already inactive product', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps({ isActive: false }));
    expect(product.isActive).toBe(false);

    const previousUpdatedAt = product.updatedAt;
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));

    product.deactivate();
    expect(product.isActive).toBe(false);
    expect(product.updatedAt).toStrictEqual(previousUpdatedAt);
  });

  it('should create timestamps when they are not provided', () => {
    vi.useFakeTimers();

    const now = new Date('2026-01-01T20:00:00.000Z');
    vi.setSystemTime(now);

    const product = new Product({
      id: 'product-id',
      name: 'Four-cheese pizza',
      description: 'A good pizza',
      price: '80.00',
      imageKey: 'image-key',
      imageMimeType: 'image/png',
      imageSize: 5_000,
      categoryId: 'pizza-id',
      isActive: true,
    });

    expect(product.createdAt).toStrictEqual(now);
    expect(product.updatedAt).toStrictEqual(now);
  });

  it('should protect createdAt from external mutation', () => {
    const product = new Product(makeProductProps());

    const originalCreatedAt = product.createdAt;
    const exposedCreatedAt = product.createdAt;
    exposedCreatedAt.setFullYear(1990);

    expect(product.createdAt).toStrictEqual(originalCreatedAt);
    expect(product.createdAt).not.toStrictEqual(exposedCreatedAt);
  });

  it('should protect updatedAt from external mutation', () => {
    const product = new Product(makeProductProps());

    const originalUpdatedAt = product.updatedAt;
    const exposedUpdatedAt = product.updatedAt;

    exposedUpdatedAt.setFullYear(1990);

    expect(product.updatedAt).toStrictEqual(originalUpdatedAt);
    expect(product.updatedAt).not.toStrictEqual(exposedUpdatedAt);
  });

  it('should reject an invalid id', () => {
    expect(() => new Product(makeProductProps({ id: ' ' }))).toThrow(InvalidProductError);
    expect(() => new Product(makeProductProps({ id: ' invalid ' }))).toThrow(
      InvalidProductError,
    );
  });

  it('should reject an invalid name', () => {
    expect(() => new Product(makeProductProps({ name: ' ' }))).toThrow(
      InvalidProductError,
    );
  });

  it('should reject an invalid description', () => {
    expect(() => new Product(makeProductProps({ description: '  ' }))).toThrow(
      InvalidProductError,
    );
    expect(() => new Product(makeProductProps({ description: 'a'.repeat(501) }))).toThrow(
      InvalidProductError,
    );
  });

  it('should reject a non-storage-neutral imageKey', () => {
    expect(() => new Product(makeProductProps({ imageKey: ' ' }))).toThrow(
      InvalidProductError,
    );
    expect(
      () => new Product(makeProductProps({ imageKey: 'https://site.com/abc123.webp' })),
    ).toThrow(InvalidProductError);
    expect(
      () => new Product(makeProductProps({ imageKey: 'C:\\images\\abc123.webp' })),
    ).toThrow(InvalidProductError);
    expect(
      () => new Product(makeProductProps({ imageKey: '/uploads/abc123.webp' })),
    ).toThrow(InvalidProductError);
  });

  it('should reject an invalid imageMimeType', () => {
    expect(
      () =>
        new Product(
          makeProductProps({ imageMimeType: ' ' as unknown as ImageMimeTypeProps }),
        ),
    ).toThrow(InvalidProductError);
    expect(
      () =>
        new Product(
          makeProductProps({
            imageMimeType: ' invalid ' as unknown as ImageMimeTypeProps,
          }),
        ),
    ).toThrow(InvalidProductError);
  });

  it('should reject an invalid imageSize', () => {
    expect(() => new Product(makeProductProps({ imageSize: 0 }))).toThrow(
      InvalidProductError,
    );

    expect(() => new Product(makeProductProps({ imageSize: -1 }))).toThrow(
      InvalidProductError,
    );

    expect(() => new Product(makeProductProps({ imageSize: 3.5 }))).toThrow(
      InvalidProductError,
    );

    expect(() => new Product(makeProductProps({ imageSize: NaN }))).toThrow(
      InvalidProductError,
    );
    expect(() => new Product(makeProductProps({ imageSize: Infinity }))).toThrow(
      InvalidProductError,
    );
    expect(
      () => new Product(makeProductProps({ imageSize: Number.MAX_SAFE_INTEGER + 1 })),
    ).toThrow(InvalidProductError);
  });

  it('should reject an invalid price', () => {
    expect(() => new Product(makeProductProps({ price: ' ' }))).toThrow(
      InvalidMoneyError,
    );
    expect(() => new Product(makeProductProps({ price: '0.00' }))).toThrow(
      InvalidMoneyError,
    );
    expect(() => new Product(makeProductProps({ price: '1' }))).toThrow(
      InvalidMoneyError,
    );
  });

  it('should reject an invalid categoryId', () => {
    expect(() => new Product(makeProductProps({ categoryId: ' ' }))).toThrow(
      InvalidProductError,
    );
    expect(() => new Product(makeProductProps({ categoryId: ' invalid ' }))).toThrow(
      InvalidProductError,
    );
  });

  it('should reject an invalid isActive', () => {
    expect(
      () => new Product(makeProductProps({ isActive: 'true' as unknown as boolean })),
    ).toThrow(InvalidProductError);
  });

  it('should reject an invalid createdAt', () => {
    expect(
      () => new Product(makeProductProps({ createdAt: new Date('invalid') })),
    ).toThrow(InvalidProductError);
  });

  it('should reject an invalid updatedAt', () => {
    expect(
      () => new Product(makeProductProps({ updatedAt: new Date('invalid') })),
    ).toThrow(InvalidProductError);
  });
  it('should reject an invalid name change', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps());
    const previousName = product.name;
    const previousUpdatedAt = product.updatedAt;

    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));

    expect(() => product.changeName(' ')).toThrow(InvalidProductError);
    expect(product.name).toBe(previousName);
    expect(product.updatedAt).toStrictEqual(previousUpdatedAt);
  });
  it('should reject an invalid description change', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps());
    const previousDescription = product.description;
    const previousUpdatedAt = product.updatedAt;

    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));

    expect(() => product.changeDescription(' ')).toThrow(InvalidProductError);
    expect(() => product.changeDescription('a'.repeat(501))).toThrow(InvalidProductError);
    expect(product.description).toBe(previousDescription);
    expect(product.updatedAt).toStrictEqual(previousUpdatedAt);
  });

  it('should reject an invalid image change', () => {
    vi.useFakeTimers();

    const image = {
      key: 'valid-imageKey',
      type: 'image/png' as ImageMimeTypeProps,
      size: 5_000,
    };

    const invalid = {
      key: '  ',
      type: 'invalid' as ImageMimeTypeProps,
      size: 0,
    };

    const product = new Product(makeProductProps());
    const previousImageKey = product.imageKey;
    const previousImageMimeType = product.imageMimeType;
    const previousImageSize = product.imageSize;
    const previousUpdatedAt = product.updatedAt;

    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));

    expect(() => product.changeImage(invalid.key, image.type, image.size)).toThrow(
      InvalidProductError,
    );

    expect(() => product.changeImage(image.key, invalid.type, image.size)).toThrow(
      InvalidProductError,
    );

    expect(() => product.changeImage(image.key, image.type, invalid.size)).toThrow(
      InvalidProductError,
    );

    expect(product.imageKey).toBe(previousImageKey);
    expect(product.imageMimeType).toBe(previousImageMimeType);
    expect(product.imageSize).toBe(previousImageSize);
    expect(product.updatedAt).toStrictEqual(previousUpdatedAt);
  });

  it('should reject an invalid price change', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps());
    const previousPrice = product.price;
    const previousUpdatedAt = product.updatedAt;

    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));

    expect(() => product.changePrice(' ')).toThrow(InvalidMoneyError);
    expect(product.price).toBe(previousPrice);
    expect(product.updatedAt).toStrictEqual(previousUpdatedAt);
  });
  it('should reject an invalid category change', () => {
    vi.useFakeTimers();

    const product = new Product(makeProductProps());
    const previousCategoryId = product.categoryId;
    const previousUpdatedAt = product.updatedAt;
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));

    expect(() => product.changeCategory(' ')).toThrow(InvalidProductError);
    expect(() => product.changeCategory(' invalid ')).toThrow(InvalidProductError);
    expect(product.categoryId).toBe(previousCategoryId);
    expect(product.updatedAt).toStrictEqual(previousUpdatedAt);
  });
});
