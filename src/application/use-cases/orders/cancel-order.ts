import type { Clock } from '@/application/services/clock';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { OrdersRepository } from '@/application/repositories/orders-repository';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

export type CancelOrderDTO = {
  actor: AuthenticatedActor;
  orderId: string;
};

class CancelOrderUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly orderRepository: OrdersRepository,
  ) {}

  async execute({ actor, orderId }: CancelOrderDTO): Promise<void> {
    void actor;

    const result = await this.orderRepository.save(orderId, (currentOrder) => {
      if (currentOrder.status !== 'DRAFT' && currentOrder.status !== 'IN_PREPARATION') {
        throw new ConflictError('Only draft or in-preparation orders can be cancelled.');
      }

      currentOrder.cancel(this.clock.now());
    });

    if (result.status === 'not-found') {
      throw new ResourceNotFoundError('Order not found.');
    }
  }
}

export { CancelOrderUseCase };
