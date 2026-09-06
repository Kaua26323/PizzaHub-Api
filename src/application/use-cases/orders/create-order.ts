import { Order } from '@/domain/entities/order';

import type { AuthenticatedActor } from '@/application/authenticated-actor';

import type { Clock } from '@/application/services/clock';
import type { IdGenerator } from '@/application/services/id-generator';
import type { OrdersRepository } from '@/application/repositories/orders-repository';

export type CreateOrderDTO = {
  actor: AuthenticatedActor;
  tableNumber: number;
  customerName?: string | null;
};

class CreateOrderUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async execute({ actor, tableNumber, customerName }: CreateOrderDTO): Promise<void> {
    const orderId = this.idGenerator.generate();

    const newOrder = Order.create({
      id: orderId,
      tableNumber,
      createdByUserId: actor.id,
      customerName: customerName ?? null,
      createdAt: this.clock.now(),
    });

    await this.ordersRepository.create(newOrder);
  }
}

export { CreateOrderUseCase };
