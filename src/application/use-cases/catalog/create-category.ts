import { Category } from '@/domain/entities/category';

import { ConflictError } from '@/application/errors/conflict-error';
import { AuthorizationError } from '@/application/errors/authorization-error';

import type { Clock } from '@/application/services/clock';
import type { IdGenerator } from '@/application/services/id-generator';
import type { CategoriesRepository } from '@/application/repositories/categories-repository';

import type { AuthenticatedActor } from '@/application/authenticated-actor';

export type CreateCategoryDTO = {
  actor: AuthenticatedActor;
  categoryName: string;
};

class CreateCategoryUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  async execute(data: CreateCategoryDTO): Promise<void> {
    const { actor, categoryName } = data;

    if (actor.role !== 'ADMIN') {
      throw new AuthorizationError();
    }

    const existingName = await this.categoriesRepository.findByName(categoryName.trim());

    if (existingName) {
      throw new ConflictError('Category name already exists.');
    }

    const categoryId = this.idGenerator.generate();
    const now = this.clock.now();

    const category = new Category({
      id: categoryId,
      name: categoryName.trim(),
      createdAt: now,
      updatedAt: now,
    });

    await this.categoriesRepository.create(category);
  }
}
export { CreateCategoryUseCase };
