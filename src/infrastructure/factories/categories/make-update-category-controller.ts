import { pool } from '@/infrastructure/database/postgres/connection/pool';

import { UpdateCategoryUseCase } from '@/application/use-cases/catalog/update-category';
import { UpdateCategoryController } from '@/presentation/http/controllers/catalog/categories/update-category-controller';
import { PostgresCategoriesRepository } from '@/infrastructure/database/postgres/repositories/postgres-categories-repository';

import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

export function makeUpdateCategoryController(
  jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
): UpdateCategoryController {
  const categoriesRepository = new PostgresCategoriesRepository(pool);

  const updateCategoryUseCase = new UpdateCategoryUseCase(categoriesRepository);

  return new UpdateCategoryController(updateCategoryUseCase, jsonBodyParserOptions);
}
