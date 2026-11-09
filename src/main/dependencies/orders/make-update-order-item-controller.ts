import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { UpdateOrderItemUseCase } from '@/application/use-cases/orders/update-order-item';
import { UpdateOrderItemController } from '@/presentation/http/controllers/orders/update-order-item-controller';
import { PostgresOrdersRepository } from '@/infrastructure/database/postgres/repositories/postgres-orders-repository';

import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

export function makeUpdateOrderItemController(
  jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
): UpdateOrderItemController {
  const ordersRepository = new PostgresOrdersRepository(pool);
  const updateOrderItemUseCase = new UpdateOrderItemUseCase(ordersRepository);

  return new UpdateOrderItemController(updateOrderItemUseCase, jsonBodyParserOptions);
}
