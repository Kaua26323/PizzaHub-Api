import { SystemClock } from '@/infrastructure/time/system-clock';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { CancelOrderUseCase } from '@/application/use-cases/orders/cancel-order';
import { CancelOrderController } from '@/presentation/http/controllers/orders/cancel-order-controller';
import { PostgresOrdersRepository } from '@/infrastructure/database/postgres/repositories/postgres-orders-repository';

export function makeCancelOrderController(): CancelOrderController {
  const clock = new SystemClock();
  const ordersRepository = new PostgresOrdersRepository(pool);
  const cancelOrderUseCase = new CancelOrderUseCase(clock, ordersRepository);

  return new CancelOrderController(cancelOrderUseCase);
}
