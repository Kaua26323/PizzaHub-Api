import { SystemClock } from '@/infrastructure/time/system-clock';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { CreateOrderUseCase } from '@/application/use-cases/orders/create-order';
import { NodeIdGenerator } from '@/infrastructure/identifiers/node-id-generator';
import { CreateOrderController } from '@/presentation/http/controllers/orders/create-order-controller';
import { PostgresOrdersRepository } from '@/infrastructure/database/postgres/repositories/postgres-orders-repository';

import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

export function makeCreateOrderController(
  jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
): CreateOrderController {
  const clock = new SystemClock();
  const idGenerator = new NodeIdGenerator();
  const ordersRepository = new PostgresOrdersRepository(pool);
  const createOrderUseCase = new CreateOrderUseCase(clock, idGenerator, ordersRepository);

  return new CreateOrderController(createOrderUseCase, jsonBodyParserOptions);
}
