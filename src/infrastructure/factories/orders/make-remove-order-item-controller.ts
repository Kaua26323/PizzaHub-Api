import { RemoveOrderItemUseCase } from '@/application/use-cases/orders/remove-order-item';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { PostgresOrdersRepository } from '@/infrastructure/database/postgres/repositories/postgres-orders-repository';
import { RemoveOrderItemController } from '@/presentation/http/controllers/orders/remove-order-item-controller';

export function makeRemoveOrderItemController(): RemoveOrderItemController {
  const ordersRepository = new PostgresOrdersRepository(pool);
  const removeOrderItemUseCase = new RemoveOrderItemUseCase(ordersRepository);

  return new RemoveOrderItemController(removeOrderItemUseCase);
}
