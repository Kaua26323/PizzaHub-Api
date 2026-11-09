import { AddOrderItemUseCase } from '@/application/use-cases/orders/add-order-item';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { PostgresOrdersRepository } from '@/infrastructure/database/postgres/repositories/postgres-orders-repository';
import { PostgresProductsRepository } from '@/infrastructure/database/postgres/repositories/postgres-products-repository';
import { NodeIdGenerator } from '@/infrastructure/identifiers/node-id-generator';
import { AddOrderItemController } from '@/presentation/http/controllers/orders/add-order-item-controller';

import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

export function makeAddOrderItemController(
  jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
): AddOrderItemController {
  const idGenerator = new NodeIdGenerator();
  const productsRepository = new PostgresProductsRepository(pool);
  const ordersRepository = new PostgresOrdersRepository(pool);
  const addOrderItemUseCase = new AddOrderItemUseCase(
    idGenerator,
    productsRepository,
    ordersRepository,
  );

  return new AddOrderItemController(addOrderItemUseCase, jsonBodyParserOptions);
}
