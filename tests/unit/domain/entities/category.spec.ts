import { afterEach, describe, expect, it, vi } from 'vitest';

import { Category } from '@/domain/entities/category';
import type { CategoryProps } from '@/domain/entities/category';
import { InvalidCategoryError } from '@/domain/errors/invalid-category-error';

function makeCategoryProps(overrides: Partial<CategoryProps> = {}): CategoryProps {
  return {
    id: 'category-id',
    name: 'Pizza',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('Domain Category (unit)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create a Category successfully', () => {
    const categoryProps = makeCategoryProps();
    const category = new Category(categoryProps);

    expect(category.id).toBe(categoryProps.id);
    expect(category.name).toBe(categoryProps.name);
    expect(category.createdAt).toStrictEqual(categoryProps.createdAt);
    expect(category.updatedAt).toStrictEqual(categoryProps.updatedAt);
  });

  it('should normalize the category name', () => {
    const category = new Category(makeCategoryProps({ name: '  Pizza  ' }));

    expect(category.name).toBe('Pizza');
  });

  it('should rename the category', () => {
    const category = new Category(makeCategoryProps());

    category.rename('Drinks');
    expect(category.name).toBe('Drinks');
  });

  it('should normalize the category name when renaming it', () => {
    const category = new Category(makeCategoryProps());

    category.rename('    Drinks   ');
    expect(category.name).toBe('Drinks');
  });

  it('should create timestamps when they are not provided', () => {
    vi.useFakeTimers();

    const now = new Date('2026-01-01T00:00:00.000Z');
    vi.setSystemTime(now);

    const category = new Category({
      id: 'random-id',
      name: 'Meats',
    });
    expect(category.createdAt).toStrictEqual(now);
    expect(category.updatedAt).toStrictEqual(now);
  });

  it('should update "updatedAt" when the name changes', () => {
    vi.useFakeTimers();
    const category = new Category(makeCategoryProps());

    const now = new Date('2026-01-01T01:00:00.000Z');
    vi.setSystemTime(now);
    category.rename('Drinks');

    expect(category.updatedAt).toStrictEqual(now);
  });
  it('should protect createdAt from external mutation', () => {
    const category = new Category(makeCategoryProps());

    const originalCreatedAt = category.createdAt;
    const exposedCreatedAt = category.createdAt;
    exposedCreatedAt.setFullYear(1990);

    expect(category.createdAt).toStrictEqual(originalCreatedAt);
    expect(category.createdAt).not.toStrictEqual(exposedCreatedAt);
  });

  it('should protect updatedAt from external mutation', () => {
    const category = new Category(makeCategoryProps());

    const originalUpdatedAt = category.updatedAt;
    const exposedUpdatedAt = category.updatedAt;

    exposedUpdatedAt.setFullYear(1990);

    expect(category.updatedAt).toStrictEqual(originalUpdatedAt);
    expect(category.updatedAt).not.toStrictEqual(exposedUpdatedAt);
  });

  it('should reject an invalid id', () => {
    expect(() => new Category(makeCategoryProps({ id: '  ' }))).toThrow(
      InvalidCategoryError,
    );
    expect(() => new Category(makeCategoryProps({ id: ' invalid ' }))).toThrow(
      InvalidCategoryError,
    );
  });

  it('should reject an invalid name', () => {
    expect(() => new Category(makeCategoryProps({ name: '   ' }))).toThrow(
      InvalidCategoryError,
    );
  });
  it('should reject an invalid createdAt', () => {
    expect(
      () =>
        new Category(
          makeCategoryProps({
            createdAt: new Date('invalid'),
          }),
        ),
    ).toThrow(InvalidCategoryError);
  });

  it('should reject an invalid updatedAt', () => {
    expect(
      () =>
        new Category(
          makeCategoryProps({
            updatedAt: new Date('invalid'),
          }),
        ),
    ).toThrow(InvalidCategoryError);
  });

  it('should reject an invalid rename', () => {
    const category = new Category(makeCategoryProps());

    const previousName = category.name;
    const previousUpdatedAt = category.updatedAt;

    expect(() => category.rename('  ')).toThrow(InvalidCategoryError);
    expect(category.name).toBe(previousName);
    expect(category.updatedAt).toStrictEqual(previousUpdatedAt);
  });
});
