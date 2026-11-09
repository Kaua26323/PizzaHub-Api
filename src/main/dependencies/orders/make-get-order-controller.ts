import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { GetOrderUseCase } from '@/application/use-cases/orders/get-order';
import { GetOrderController } from '@/presentation/http/controllers/orders/get-order-controller';
import { PostgresOrdersRepository } from '@/infrastructure/database/postgres/repositories/postgres-orders-repository';

export function makeGetOrderController(): GetOrderController {
  const ordersRepository = new PostgresOrdersRepository(pool);
  const getOrderUseCase = new GetOrderUseCase(ordersRepository);

  return new GetOrderController(getOrderUseCase);
}
