import { ListOrdersUseCase } from '@/application/use-cases/orders/list-orders';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { PostgresOrdersRepository } from '@/infrastructure/database/postgres/repositories/postgres-orders-repository';
import { ListOrdersController } from '@/presentation/http/controllers/orders/list-orders-controller';

export function makeListOrdersController(): ListOrdersController {
  const ordersRepository = new PostgresOrdersRepository(pool);
  const listOrdersUseCase = new ListOrdersUseCase(ordersRepository);

  return new ListOrdersController(listOrdersUseCase);
}
