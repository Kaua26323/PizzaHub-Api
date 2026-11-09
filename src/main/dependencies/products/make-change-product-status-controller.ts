import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { ChangeProductStatusUseCase } from '@/application/use-cases/catalog/change-product-status';
import { PostgresProductsRepository } from '@/infrastructure/database/postgres/repositories/postgres-products-repository';
import { ChangeProductStatusController } from '@/presentation/http/controllers/catalog/products/change-product-status-controller';

import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

export function makeChangeProductStatusController(
  jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
): ChangeProductStatusController {
  const productsRepository = new PostgresProductsRepository(pool);
  const changeProductStatusUseCase = new ChangeProductStatusUseCase(productsRepository);

  return new ChangeProductStatusController(
    changeProductStatusUseCase,
    jsonBodyParserOptions,
  );
}
