import { ConflictError } from '@/application/errors/conflict-error';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { CategoriesRepository } from '@/application/repositories/categories-repository';

export type UpdateCategoryDTO = {
  actor: AuthenticatedActor;
  categoryId: string;
  categoryName: string;
};

class UpdateCategoryUseCase {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async execute(data: UpdateCategoryDTO): Promise<void> {
    const { actor, categoryId, categoryName } = data;

    if (actor.role !== 'ADMIN') {
      throw new AuthorizationError('FORBIDDEN');
    }

    const category = await this.categoriesRepository.findById(categoryId);

    if (!category) {
      throw new ResourceNotFoundError('CATEGORY_NOT_FOUND');
    }

    const categoryWithSameName = await this.categoriesRepository.findByName(
      categoryName.trim(),
    );

    if (categoryWithSameName && categoryWithSameName.id !== categoryId) {
      throw new ConflictError(
        'CATEGORY_NAME_ALREADY_EXISTS',
        'Category name already exists.',
      );
    }

    category.rename(categoryName);
    await this.categoriesRepository.rename(category);
  }
}
export { UpdateCategoryUseCase };
