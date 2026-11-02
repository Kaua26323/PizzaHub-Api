import { pool } from '@/infrastructure/database/postgres/connection/pool';

import { ListCategoriesUseCase } from '@/application/use-cases/catalog/list-categories';
import { ListCategoriesController } from '@/presentation/http/controllers/catalog/categories/list-categories-controller';
import { PostgresCategoriesRepository } from '@/infrastructure/database/postgres/repositories/postgres-categories-repository';

export function makeListCategoriesController(): ListCategoriesController {
  const categoriesRepository = new PostgresCategoriesRepository(pool);

  const listCategoriesUseCase = new ListCategoriesUseCase(categoriesRepository);

  return new ListCategoriesController(listCategoriesUseCase);
}
