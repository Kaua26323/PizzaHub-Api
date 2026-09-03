import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ConflictError } from '@/application/errors/conflict-error';
import { CreateCategoryUseCase } from '@/application/use-cases/catalog/create-category';
import { Category } from '@/domain/entities/category';
import { InMemoryCategoriesRepository } from '@tests/doubles/repositories/in-memory-categories-repository';
import { FakeClock } from '@tests/doubles/services/fake-clock';
import { FakeIdGenerator } from '@tests/doubles/services/fake-id-generator';
import { describe, expect, it } from 'vitest';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const clock = new FakeClock(currentDate);
  const idGenerator = new FakeIdGenerator(['category-id']);
  const categoriesRepository = new InMemoryCategoriesRepository();

  const sut = new CreateCategoryUseCase(clock, idGenerator, categoriesRepository);

  return { sut, clock, idGenerator, categoriesRepository };
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

describe('CreateCategoryUseCase', () => {
  it('should create a category when the actor is ADMIN', async () => {
    const { sut, idGenerator, categoriesRepository } = makeSut();

    await sut.execute({ actor: makeActor(), categoryName: ' Pizza ' });

    const categories = categoriesRepository.categories;

    expect(categories).toHaveLength(1);
    expect(categories[0]?.id).toBe('category-id');
    expect(categories[0]?.name).toBe('Pizza');
    expect(categories[0]?.createdAt).toStrictEqual(currentDate);
    expect(categories[0]?.updatedAt).toStrictEqual(currentDate);

    expect(idGenerator.generatedIds[0]).toBe('category-id');
  });

  it('should reject category creation when the actor is STAFF', async () => {
    const { sut, idGenerator, categoriesRepository } = makeSut();

    const result = sut.execute({
      actor: makeActor({ role: 'STAFF' }),
      categoryName: ' Pizza ',
    });
    await expect(result).rejects.toThrow(AuthorizationError);
    expect(idGenerator.generatedIds).toHaveLength(0);
    expect(categoriesRepository.categories).toHaveLength(0);
  });

  it('should reject a duplicate normalized category name', async () => {
    const { sut, idGenerator, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    const result = sut.execute({ actor: makeActor(), categoryName: ' Pizza ' });

    await expect(result).rejects.toThrow(ConflictError);
    await expect(result).rejects.toThrow('Category name already exists.');
    expect(idGenerator.generatedIds).toHaveLength(0);
    expect(categoriesRepository.categories).toHaveLength(1);
  });
});
