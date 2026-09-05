import { describe, expect, it } from 'vitest';

import { Category } from '@/domain/entities/category';

import { ConflictError } from '@/application/errors/conflict-error';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { DeleteCategoryUseCase } from '@/application/use-cases/catalog/delete-category';
import { InMemoryCategoriesRepository } from '@tests/doubles/repositories/in-memory-categories-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const categoriesRepository = new InMemoryCategoriesRepository();

  const sut = new DeleteCategoryUseCase(categoriesRepository);

  return { sut, categoriesRepository };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return new Category({
    id: 'id-1',
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

describe('DeleteCategoryUseCase', () => {
  it('should delete a category when the actor is ADMIN', async () => {
    const { sut, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    expect(categoriesRepository.categories).toHaveLength(1);

    await sut.execute({ actor: makeActor(), categoryId: 'id-1' });

    expect(categoriesRepository.categories).toHaveLength(0);
  });

  it('should reject category deletion when the actor is STAFF', async () => {
    const { sut, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    const result = sut.execute({
      actor: makeActor({ role: 'STAFF' }),
      categoryId: 'id-1',
    });

    await expect(result).rejects.toThrow(AuthorizationError);
    expect(categoriesRepository.categories).toHaveLength(1);
  });

  it('should reject deletion when the category does not exist', async () => {
    const { sut } = makeSut();

    const result = sut.execute({
      actor: makeActor({ role: 'ADMIN' }),
      categoryId: 'id-1',
    });

    await expect(result).rejects.toThrow(ResourceNotFoundError);
  });

  it('should reject deletion while products reference the category', async () => {
    const { sut, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    categoriesRepository.categoryIdsWithProducts.add('id-1');

    const result = sut.execute({
      actor: makeActor({ role: 'ADMIN' }),
      categoryId: 'id-1',
    });

    await expect(result).rejects.toThrow(ConflictError);
    expect(categoriesRepository.categories).toHaveLength(1);
  });
});
