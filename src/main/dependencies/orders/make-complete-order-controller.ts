import { SystemClock } from '@/infrastructure/time/system-clock';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { CompleteOrderUseCase } from '@/application/use-cases/orders/complete-order';
import { CompleteOrderController } from '@/presentation/http/controllers/orders/complete-order-controller';
import { PostgresOrdersRepository } from '@/infrastructure/database/postgres/repositories/postgres-orders-repository';

export function makeCompleteOrderController(): CompleteOrderController {
  const clock = new SystemClock();
  const ordersRepository = new PostgresOrdersRepository(pool);
  const completeOrderUseCase = new CompleteOrderUseCase(clock, ordersRepository);

  return new CompleteOrderController(completeOrderUseCase);
}
