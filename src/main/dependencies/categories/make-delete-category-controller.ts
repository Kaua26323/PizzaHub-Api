import { pool } from '@/infrastructure/database/postgres/connection/pool';

import { DeleteCategoryUseCase } from '@/application/use-cases/catalog/delete-category';
import { DeleteCategoryController } from '@/presentation/http/controllers/catalog/categories/delete-category-controller';
import { PostgresCategoriesRepository } from '@/infrastructure/database/postgres/repositories/postgres-categories-repository';

export function makeDeleteCategoryController(): DeleteCategoryController {
  const categoriesRepository = new PostgresCategoriesRepository(pool);

  const deleteCategoryUseCase = new DeleteCategoryUseCase(categoriesRepository);

  return new DeleteCategoryController(deleteCategoryUseCase);
}
