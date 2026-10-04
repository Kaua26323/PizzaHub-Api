import { describe, expect, it } from 'vitest';

import { Category } from '@/domain/entities/category';
import type { CategoryProps } from '@/domain/entities/category';

import { PostgresCategoriesRepository } from '@/infrastructure/database/postgres/repositories/postgres-categories-repository';

import { testPool } from '@tests/setup/postgres';

const currentDate = new Date('2026-01-10T13:15:00.000Z');
const laterDate = new Date('2026-01-11T13:15:00.000Z');

type CategoryRow = {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
};

function makeSut() {
  const sut = new PostgresCategoriesRepository(testPool);

  return { sut };
}

function makeCategory(overrides: Partial<CategoryProps> = {}): Category {
  return new Category({
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Pizzas',
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

async function insertCategory(category: Category): Promise<void> {
  await testPool.query(
    `
      INSERT INTO categories (
        id,
        name,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4);
    `,
    [category.id, category.name, category.createdAt, category.updatedAt],
  );
}

async function findCategoryRowById(categoryId: string): Promise<CategoryRow | null> {
  const result = await testPool.query<CategoryRow>(
    `
      SELECT
        id,
        name,
        created_at,
        updated_at
      FROM categories
      WHERE id = $1;
    `,
    [categoryId],
  );

  return result.rows[0] ?? null;
}

async function insertProduct(categoryId: string): Promise<void> {
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
      );
    `,
    [
      '660e8400-e29b-41d4-a716-446655440001',
      'Calabresa',
      'Pizza de calabresa com cebola',
      '49.90',
      'products/calabresa.webp',
      'image/webp',
      1024,
      true,
      categoryId,
      currentDate,
      currentDate,
    ],
  );
}

describe('PostgresCategoriesRepository', () => {
  describe('create', () => {
    it('should create a category', async () => {
      const { sut } = makeSut();

      const category = makeCategory();

      await sut.create(category);

      const persistedCategory = await findCategoryRowById(category.id);

      expect(persistedCategory).not.toBeNull();
      expect(persistedCategory?.id).toBe(category.id);
      expect(persistedCategory?.name).toBe(category.name);
      expect(persistedCategory?.created_at).toStrictEqual(category.createdAt);
      expect(persistedCategory?.updated_at).toStrictEqual(category.updatedAt);
    });

    it('should fail when creating a category with a duplicate name', async () => {
      const { sut } = makeSut();

      const firstCategory = makeCategory();

      const secondCategory = makeCategory({
        id: '550e8400-e29b-41d4-a716-446655440002',
      });

      await sut.create(firstCategory);

      await expect(sut.create(secondCategory)).rejects.toMatchObject({
        code: '23505',
      });
    });
  });

  describe('listAll', () => {
    it('should return all categories ordered by creation date', async () => {
      const { sut } = makeSut();

      const firstCategory = makeCategory({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Pizzas',
        createdAt: currentDate,
        updatedAt: currentDate,
      });

      const secondCategory = makeCategory({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Drinks',
        createdAt: laterDate,
        updatedAt: laterDate,
      });

      await insertCategory(firstCategory);
      await insertCategory(secondCategory);

      const result = await sut.listAll();

      expect(result).toHaveLength(2);

      expect(result[0]).toBeInstanceOf(Category);
      expect(result[1]).toBeInstanceOf(Category);

      expect(result[0]?.id).toBe(firstCategory.id);
      expect(result[0]?.name).toBe(firstCategory.name);
      expect(result[0]?.createdAt).toStrictEqual(firstCategory.createdAt);
      expect(result[0]?.updatedAt).toStrictEqual(firstCategory.updatedAt);

      expect(result[1]?.id).toBe(secondCategory.id);
      expect(result[1]?.name).toBe(secondCategory.name);
      expect(result[1]?.createdAt).toStrictEqual(secondCategory.createdAt);
      expect(result[1]?.updatedAt).toStrictEqual(secondCategory.updatedAt);
    });

    it('should return an empty array when there are no categories', async () => {
      const { sut } = makeSut();

      const result = await sut.listAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return a category by id', async () => {
      const { sut } = makeSut();

      const category = makeCategory();

      await insertCategory(category);

      const result = await sut.findById(category.id);

      expect(result).toBeInstanceOf(Category);

      expect(result?.id).toBe(category.id);
      expect(result?.name).toBe(category.name);
      expect(result?.createdAt).toStrictEqual(category.createdAt);
      expect(result?.updatedAt).toStrictEqual(category.updatedAt);
    });

    it('should return null when the category does not exist', async () => {
      const { sut } = makeSut();

      const result = await sut.findById('00000000-0000-4000-8000-000000000001');

      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should return a category by name', async () => {
      const { sut } = makeSut();

      const category = makeCategory();

      await insertCategory(category);

      const result = await sut.findByName(category.name);

      expect(result).toBeInstanceOf(Category);

      expect(result?.id).toBe(category.id);
      expect(result?.name).toBe(category.name);
      expect(result?.createdAt).toStrictEqual(category.createdAt);
      expect(result?.updatedAt).toStrictEqual(category.updatedAt);
    });

    it('should return null when the category name does not exist', async () => {
      const { sut } = makeSut();

      const result = await sut.findByName('Missing category');

      expect(result).toBeNull();
    });
  });

  describe('hasProducts', () => {
    it('should return true when the category has products', async () => {
      const { sut } = makeSut();

      const category = makeCategory();

      await insertCategory(category);
      await insertProduct(category.id);

      const result = await sut.hasProducts(category.id);

      expect(result).toBe(true);
    });

    it('should return false when the category has no products', async () => {
      const { sut } = makeSut();

      const category = makeCategory();

      await insertCategory(category);

      const result = await sut.hasProducts(category.id);

      expect(result).toBe(false);
    });

    it('should return false when the category does not exist', async () => {
      const { sut } = makeSut();

      const result = await sut.hasProducts('00000000-0000-4000-8000-000000000001');

      expect(result).toBe(false);
    });
  });

  describe('rename', () => {
    it('should rename a category and update its timestamp', async () => {
      const { sut } = makeSut();

      const category = makeCategory();

      await insertCategory(category);

      const renamedCategory = makeCategory({
        id: category.id,
        name: 'Special Pizzas',
        createdAt: category.createdAt,
        updatedAt: laterDate,
      });

      await sut.rename(renamedCategory);

      const persistedCategory = await findCategoryRowById(category.id);

      expect(persistedCategory?.id).toBe(category.id);
      expect(persistedCategory?.name).toBe('Special Pizzas');
      expect(persistedCategory?.created_at).toStrictEqual(currentDate);
      expect(persistedCategory?.updated_at).toStrictEqual(laterDate);
    });
  });

  describe('delete', () => {
    it('should delete a category', async () => {
      const { sut } = makeSut();

      const category = makeCategory();

      await insertCategory(category);

      await sut.delete(category.id);

      const persistedCategory = await findCategoryRowById(category.id);

      expect(persistedCategory).toBeNull();
    });

    it('should not fail when deleting a category that does not exist', async () => {
      const { sut } = makeSut();

      await expect(
        sut.delete('00000000-0000-4000-8000-000000000001'),
      ).resolves.toBeUndefined();
    });
  });
});
