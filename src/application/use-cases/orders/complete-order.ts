import type { AuthenticatedActor } from '@/application/authenticated-actor';

import type { Clock } from '@/application/services/clock';
import type { OrdersRepository } from '@/application/repositories/orders-repository';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

export type CompleteOrderDTO = {
  actor: AuthenticatedActor;
  orderId: string;
};

class CompleteOrderUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly ordersRepository: OrdersRepository,
  ) {}
  async execute({ actor, orderId }: CompleteOrderDTO): Promise<void> {
    void actor;

    const result = await this.ordersRepository.save(orderId, (currentOrder) => {
      if (currentOrder.status !== 'IN_PREPARATION') {
        throw new ConflictError('Only orders in preparation can be completed.');
      }

      currentOrder.complete(this.clock.now());
    });

    if (result.status === 'not-found') {
      throw new ResourceNotFoundError('Order not found.');
    }
  }
}

export { CompleteOrderUseCase };
