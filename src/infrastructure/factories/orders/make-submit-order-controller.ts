import { SystemClock } from '@/infrastructure/time/system-clock';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { SubmitOrderUseCase } from '@/application/use-cases/orders/submit-order';
import { SubmitOrderController } from '@/presentation/http/controllers/orders/submit-order-controller';
import { PostgresOrdersRepository } from '@/infrastructure/database/postgres/repositories/postgres-orders-repository';

export function makeSubmitOrderController(): SubmitOrderController {
  const clock = new SystemClock();
  const ordersRepository = new PostgresOrdersRepository(pool);
  const submitOrderUseCase = new SubmitOrderUseCase(clock, ordersRepository);

  return new SubmitOrderController(submitOrderUseCase);
}
