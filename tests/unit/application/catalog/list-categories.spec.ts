import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { ListCategoriesUseCase } from '@/application/use-cases/catalog/list-categories';
import { Category } from '@/domain/entities/category';
import { InMemoryCategoriesRepository } from '@tests/doubles/repositories/in-memory-categories-repository';
import { describe, expect, it } from 'vitest';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const categoriesRepository = new InMemoryCategoriesRepository();
  const sut = new ListCategoriesUseCase(categoriesRepository);

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

describe('ListCategoriesUseCase', () => {
  it('should allow an ADMIN to list categories', async () => {
    const { sut, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    const list = await sut.execute(makeActor({ role: 'ADMIN' }));

    expect(list).toEqual([
      {
        id: 'id-1',
        name: 'Pizza',
        createdAt: currentDate,
        updatedAt: currentDate,
      },
    ]);
  });

  it('should allow a STAFF member to list categories', async () => {
    const { sut, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    const list = await sut.execute(makeActor({ role: 'STAFF' }));

    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('Pizza');
  });

  it('should return an empty list when there are no categories', async () => {
    const { sut } = makeSut();

    const list = await sut.execute(makeActor({ role: 'STAFF' }));

    expect(list).toEqual([]);
  });
});
