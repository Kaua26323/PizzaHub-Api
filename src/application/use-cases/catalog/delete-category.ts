import { ConflictError } from '@/application/errors/conflict-error';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { CategoriesRepository } from '@/application/repositories/categories-repository';

export type DeleteCategoryDTO = {
  actor: AuthenticatedActor;
  categoryId: string;
};

class DeleteCategoryUseCase {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async execute({ actor, categoryId }: DeleteCategoryDTO): Promise<void> {
    if (actor.role !== 'ADMIN') {
      throw new AuthorizationError('FORBIDDEN');
    }

    const category = await this.categoriesRepository.findById(categoryId);

    if (!category) {
      throw new ResourceNotFoundError('CATEGORY_NOT_FOUND', 'Category not found.');
    }

    const hasProducts = await this.categoriesRepository.hasProducts(categoryId);

    if (hasProducts) {
      throw new ConflictError(
        'CATEGORY_NOT_EMPTY',
        'Category cannot be deleted while it has associated products.',
      );
    }

    await this.categoriesRepository.delete(categoryId);
  }
}

export { DeleteCategoryUseCase };
