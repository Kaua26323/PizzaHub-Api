import { afterEach, describe, expect, it, vi } from 'vitest';

import { Category } from '@/domain/entities/category';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { UpdateCategoryUseCase } from '@/application/use-cases/catalog/update-category';

import { ConflictError } from '@/application/errors/conflict-error';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import { InMemoryCategoriesRepository } from '@tests/doubles/repositories/in-memory-categories-repository';
const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const categoriesRepository = new InMemoryCategoriesRepository();

  const sut = new UpdateCategoryUseCase(categoriesRepository);

  return { sut, categoriesRepository };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return new Category({
    id: 'category-id',
    name: 'Pizza',
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

function makeActor(overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    id: 'user-id',
    role: 'ADMIN',
    ...overrides,
  };
}

describe('UpdateCategoryUseCase', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should rename a category when the actor is ADMIN', async () => {
    const { sut, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    vi.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));

    await sut.execute({
      actor: makeActor(),
      categoryId: 'category-id',
      categoryName: ' Cake ',
    });

    const category = categoriesRepository.categories[0];

    expect(categoriesRepository.categories).toHaveLength(1);
    expect(category?.name).toBe('Cake');
    expect(category?.updatedAt).toStrictEqual(new Date('2026-01-10T00:00:00.000Z'));
  });

  it('should allow renaming a category to its own normalized name', async () => {
    const { sut, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    vi.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));

    await sut.execute({
      actor: makeActor(),
      categoryId: 'category-id',
      categoryName: ' Pizza ',
    });

    const category = categoriesRepository.categories[0];

    expect(category?.name).toBe('Pizza');
    expect(category?.updatedAt).toStrictEqual(new Date('2026-01-10T00:00:00.000Z'));
  });

  it('should reject a category rename when the actor is STAFF', async () => {
    const { sut, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    const result = sut.execute({
      actor: makeActor({ role: 'STAFF' }),
      categoryId: 'category-id',
      categoryName: 'Cake',
    });

    await expect(result).rejects.toThrow(AuthorizationError);

    const category = categoriesRepository.categories[0];

    expect(category?.name).toBe('Pizza');
    expect(category?.updatedAt).toStrictEqual(category?.createdAt);
  });

  it('should reject a name already used by another category', async () => {
    const { sut, categoriesRepository } = makeSut();

    await categoriesRepository.create(
      makeCategory({
        id: 'pizza-id',
        name: 'Pizza',
      }),
    );

    await categoriesRepository.create(
      makeCategory({
        id: 'drinks-id',
        name: 'Drinks',
      }),
    );

    const result = sut.execute({
      actor: makeActor(),
      categoryId: 'drinks-id',
      categoryName: ' Pizza ',
    });

    await expect(result).rejects.toThrow(ConflictError);

    const drinksCategory = categoriesRepository.categories.find(
      (category) => category.id === 'drinks-id',
    );

    expect(drinksCategory?.name).toBe('Drinks');
    expect(drinksCategory?.updatedAt).toStrictEqual(drinksCategory?.createdAt);
  });

  it('should reject when the category does not exist', async () => {
    const { sut, categoriesRepository } = makeSut();

    const result = sut.execute({
      actor: makeActor(),
      categoryId: 'unknown-category-id',
      categoryName: 'Cake',
    });

    await expect(result).rejects.toThrow(ResourceNotFoundError);
    expect(categoriesRepository.categories).toHaveLength(0);
  });
});
