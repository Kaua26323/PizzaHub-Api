import { describe, expect, it } from 'vitest';

import { Product } from '@/domain/entities/product';
import type { ImageMimeTypeProps, ProductProps } from '@/domain/entities/product';
import { PostgresProductsRepository } from '@/infrastructure/database/postgres/repositories/postgres-products-repository';

import { testPool } from '@tests/setup/postgres';

const currentDate = new Date('2026-01-10T13:15:00.000Z');
const laterDate = new Date('2026-01-11T13:15:00.000Z');

const missingProductId = '00000000-0000-4000-8000-000000000001';
const firstCategoryId = '550e8400-e29b-41d4-a716-446655440001';
const secondCategoryId = '550e8400-e29b-41d4-a716-446655440002';

type ProductRow = {
  id: string;
  name: string;
  description: string;
  price: string;
  image_key: string;
  image_mime_type: ImageMimeTypeProps;
  image_size: number;
  is_active: boolean;
  category_id: string;
  created_at: Date;
  updated_at: Date;
};

function makeSut(): PostgresProductsRepository {
  return new PostgresProductsRepository(testPool);
}

function makeProduct(overrides: Partial<ProductProps> = {}): Product {
  return new Product({
    id: '660e8400-e29b-41d4-a716-446655440001',
    name: 'Sausage Pizza',
    description: 'Pizza with sausage and onions',
    price: '49.90',
    imageKey: 'products/sausage-pizza.webp',
    imageMimeType: 'image/webp',
    imageSize: 1024,
    isActive: true,
    categoryId: firstCategoryId,
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

async function insertCategory(id = firstCategoryId, name = 'Pizzas'): Promise<void> {
  await testPool.query(
    `
      INSERT INTO categories (id, name)
      VALUES ($1, $2)
    `,
    [id, name],
  );
}

async function insertProduct(product: Product): Promise<void> {
  await testPool.query(
    `
      INSERT INTO products (
        id,
        name,
        description,
        price,
        image_key,
        image_mime_type,
        image_size,
        is_active,
        category_id,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11
      )
    `,
    [
      product.id,
      product.name,
      product.description,
      product.price,
      product.imageKey,
      product.imageMimeType,
      product.imageSize,
      product.isActive,
      product.categoryId,
      product.createdAt,
      product.updatedAt,
    ],
  );
}

async function findProductRowById(id: string): Promise<ProductRow | null> {
  const result = await testPool.query<ProductRow>(
    `
      SELECT
        id,
        name,
        description,
        price,
        image_key,
        image_mime_type,
        image_size,
        is_active,
        category_id,
        created_at,
        updated_at
      FROM products
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

function expectProductFields(product: Product, expected: Product): void {
  expect(product).toBeInstanceOf(Product);

  expect(product.id).toBe(expected.id);
  expect(product.name).toBe(expected.name);
  expect(product.description).toBe(expected.description);
  expect(product.price).toBe(expected.price);

  expect(product.imageKey).toBe(expected.imageKey);
  expect(product.imageMimeType).toBe(expected.imageMimeType);
  expect(product.imageSize).toBe(expected.imageSize);

  expect(product.isActive).toBe(expected.isActive);
  expect(product.categoryId).toBe(expected.categoryId);

  expect(product.createdAt).toStrictEqual(expected.createdAt);
  expect(product.updatedAt).toStrictEqual(expected.updatedAt);
}

async function insertOrderItem(product: Product): Promise<void> {
  const userId = '770e8400-e29b-41d4-a716-446655440001';
  const orderId = '880e8400-e29b-41d4-a716-446655440001';

  await testPool.query(
    `
      INSERT INTO users (
        id,
        name,
        email,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [userId, 'Test User', 'products-test@example.com', 'test-hash', 'STAFF'],
  );

  await testPool.query(
    `
      INSERT INTO orders (
        id,
        table_number,
        created_by_user_id
      )
      VALUES ($1, $2, $3)
    `,
    [orderId, 1, userId],
  );

  await testPool.query(
    `
      INSERT INTO order_items (
        id,
        order_id,
        product_id,
        product_name,
        unit_price,
        quantity
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      '990e8400-e29b-41d4-a716-446655440001',
      orderId,
      product.id,
      product.name,
      product.price,
      1,
    ],
  );
}

describe('PostgresProductsRepository', () => {
  describe('create', () => {
    it('should persist every product field', async () => {
      const sut = makeSut();
      const product = makeProduct();

      await insertCategory();

      await sut.create(product);

      expect(await findProductRowById(product.id)).toEqual({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        image_key: product.imageKey,
        image_mime_type: product.imageMimeType,
        image_size: product.imageSize,
        is_active: product.isActive,
        category_id: product.categoryId,
        created_at: product.createdAt,
        updated_at: product.updatedAt,
      });
    });

    it('should preserve the canonical price string', async () => {
      const sut = makeSut();

      const product = makeProduct({
        price: '49.90',
      });

      await insertCategory();

      await sut.create(product);

      const row = await findProductRowById(product.id);

      expect(row?.price).toBe('49.90');
      expect(typeof row?.price).toBe('string');
    });
  });

  describe('findById', () => {
    it('should return a Product when the product exists', async () => {
      const sut = makeSut();
      const product = makeProduct();

      await insertCategory();
      await insertProduct(product);

      const result = await sut.findById(product.id);

      expect(result).toBeInstanceOf(Product);
      expect(result?.id).toBe(product.id);
    });

    it('should map every database column to Product', async () => {
      const sut = makeSut();

      const product = makeProduct({
        isActive: false,
        price: '73.40',
      });

      await insertCategory();
      await insertProduct(product);

      const result = await sut.findById(product.id);

      expect(result).not.toBeNull();

      expectProductFields(result!, product);
    });

    it('should return null when the product does not exist', async () => {
      expect(await makeSut().findById(missingProductId)).toBeNull();
    });
  });

  describe('listAll', () => {
    it('should return products from all categories when no filter is provided', async () => {
      const sut = makeSut();

      const first = makeProduct();

      const second = makeProduct({
        id: '660e8400-e29b-41d4-a716-446655440002',
        name: 'Cola',
        description: 'Cola soft drink',
        imageKey: 'products/cola.png',
        categoryId: secondCategoryId,
      });

      await insertCategory();
      await insertCategory(secondCategoryId, 'Drinks');

      await insertProduct(first);
      await insertProduct(second);

      const result = await sut.listAll();

      expect(result).toHaveLength(2);

      expect(result.map((product) => product.id)).toEqual(
        expect.arrayContaining([first.id, second.id]),
      );
    });

    it('should return only products from the requested category', async () => {
      const sut = makeSut();

      const first = makeProduct();

      const second = makeProduct({
        id: '660e8400-e29b-41d4-a716-446655440002',
        name: 'Cola',
        description: 'Cola soft drink',
        imageKey: 'products/cola.png',
        categoryId: secondCategoryId,
      });

      await insertCategory();
      await insertCategory(secondCategoryId, 'Drinks');

      await insertProduct(first);
      await insertProduct(second);

      const result = await sut.listAll({
        categoryId: firstCategoryId,
      });

      expect(result.map((product) => product.id)).toEqual([first.id]);
    });

    it('should return an empty array when there are no products', async () => {
      expect(await makeSut().listAll()).toEqual([]);
    });

    it('should return products ordered by creation date', async () => {
      const sut = makeSut();

      const earlier = makeProduct();

      const later = makeProduct({
        id: '660e8400-e29b-41d4-a716-446655440002',
        name: 'Margherita Pizza',
        imageKey: 'products/margherita.webp',
        createdAt: laterDate,
        updatedAt: laterDate,
      });

      await insertCategory();

      await insertProduct(later);
      await insertProduct(earlier);

      const result = await sut.listAll();

      expect(result.map((product) => product.id)).toEqual([earlier.id, later.id]);

      const filtered = await sut.listAll({
        categoryId: firstCategoryId,
      });

      expect(filtered.map((product) => product.id)).toEqual([earlier.id, later.id]);
    });

    it('should map listed rows to Product instances', async () => {
      const sut = makeSut();

      const product = makeProduct({
        isActive: false,
        price: '73.40',
      });

      await insertCategory();
      await insertProduct(product);

      const result = await sut.listAll();

      expect(result).toHaveLength(1);

      expectProductFields(result[0]!, product);
    });
  });

  describe('hasOrderHistory', () => {
    it('should return false when the product has no order history', async () => {
      const sut = makeSut();

      const product = makeProduct();

      const other = makeProduct({
        id: '660e8400-e29b-41d4-a716-446655440002',
        name: 'Margherita Pizza',
        imageKey: 'products/margherita.webp',
      });

      await insertCategory();
      await insertProduct(product);
      await insertProduct(other);
      await insertOrderItem(other);

      expect(await sut.hasOrderHistory(product.id)).toBe(false);
    });

    it('should return true when the product has order history', async () => {
      const sut = makeSut();
      const product = makeProduct();

      await insertCategory();
      await insertProduct(product);
      await insertOrderItem(product);

      expect(await sut.hasOrderHistory(product.id)).toBe(true);
    });

    it('should return false when the product does not exist', async () => {
      expect(await makeSut().hasOrderHistory(missingProductId)).toBe(false);
    });
  });

  describe('update', () => {
    it('should update every mutable product field', async () => {
      const sut = makeSut();

      const product = makeProduct();

      const changed = makeProduct({
        name: 'Special Pizza',
        description: 'Special pizza with cheese',
        price: '62.50',
        imageKey: 'products/special.png',
        imageMimeType: 'image/png',
        imageSize: 2048,
        categoryId: secondCategoryId,
        updatedAt: laterDate,
      });

      await insertCategory();

      await insertCategory(secondCategoryId, 'Specials');

      await insertProduct(product);

      const other = makeProduct({
        id: '660e8400-e29b-41d4-a716-446655440002',
        name: 'Margherita Pizza',
        imageKey: 'products/margherita.webp',
      });

      await insertProduct(other);

      await sut.update(changed);

      const row = await findProductRowById(product.id);

      expect(row).toMatchObject({
        name: changed.name,
        description: changed.description,
        price: changed.price,
        image_key: changed.imageKey,
        image_mime_type: changed.imageMimeType,
        image_size: changed.imageSize,
        category_id: changed.categoryId,
      });

      expect(await findProductRowById(other.id)).toMatchObject({
        name: other.name,
        price: other.price,
        category_id: other.categoryId,
      });
    });

    it('should persist changes to isActive', async () => {
      const sut = makeSut();
      const product = makeProduct();

      await insertCategory();
      await insertProduct(product);

      await sut.update(
        makeProduct({
          isActive: false,
          updatedAt: laterDate,
        }),
      );

      expect((await findProductRowById(product.id))?.is_active).toBe(false);
    });

    it('should persist changes to updatedAt', async () => {
      const sut = makeSut();
      const product = makeProduct();

      await insertCategory();
      await insertProduct(product);

      await sut.update(
        makeProduct({
          updatedAt: laterDate,
        }),
      );

      expect((await findProductRowById(product.id))?.updated_at).toStrictEqual(laterDate);
    });

    it('should preserve createdAt when updating a product', async () => {
      const sut = makeSut();
      const product = makeProduct();

      await insertCategory();
      await insertProduct(product);

      await sut.update(
        makeProduct({
          createdAt: laterDate,
          updatedAt: laterDate,
        }),
      );

      const row = await findProductRowById(product.id);

      expect(row?.id).toBe(product.id);
      expect(row?.created_at).toStrictEqual(currentDate);
    });

    it('should preserve the canonical price string after an update', async () => {
      const sut = makeSut();

      const product = makeProduct({
        price: '29.00',
      });

      await insertCategory();
      await insertProduct(product);

      await sut.update(
        makeProduct({
          price: '49.90',
          updatedAt: laterDate,
        }),
      );

      const row = await findProductRowById(product.id);

      expect(row?.price).toBe('49.90');
      expect(typeof row?.price).toBe('string');
    });
  });

  describe('delete', () => {
    it('should delete only the product with the specified id', async () => {
      const sut = makeSut();

      const product = makeProduct();

      const other = makeProduct({
        id: '660e8400-e29b-41d4-a716-446655440002',
        name: 'Margherita Pizza',
        imageKey: 'products/margherita.webp',
      });

      await insertCategory();

      await insertProduct(product);
      await insertProduct(other);

      await sut.delete(product.id);

      expect(await findProductRowById(product.id)).toBeNull();
      expect(await findProductRowById(other.id)).not.toBeNull();
    });

    it('should not throw when the product does not exist', async () => {
      await expect(makeSut().delete(missingProductId)).resolves.toBeUndefined();
    });
  });
});
