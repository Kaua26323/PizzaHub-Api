import { pool } from '@/infrastructure/database/postgres/connection/pool';

import { SystemClock } from '@/infrastructure/time/system-clock';
import { NodeIdGenerator } from '@/infrastructure/identifiers/node-id-generator';
import { CreateCategoryUseCase } from '@/application/use-cases/catalog/create-category';
import { CreateCategoryController } from '@/presentation/http/controllers/catalog/categories/create-category-controller';
import { PostgresCategoriesRepository } from '@/infrastructure/database/postgres/repositories/postgres-categories-repository';

import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

export function makeCreateCategoryController(
  jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
): CreateCategoryController {
  const clock = new SystemClock();
  const idGenerator = new NodeIdGenerator();
  const categoriesRepository = new PostgresCategoriesRepository(pool);

  const createCategoryUseCase = new CreateCategoryUseCase(
    clock,
    idGenerator,
    categoriesRepository,
  );

  return new CreateCategoryController(createCategoryUseCase, jsonBodyParserOptions);
}
