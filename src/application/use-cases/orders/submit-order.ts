import type { Clock } from '@/application/services/clock';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { OrdersRepository } from '@/application/repositories/orders-repository';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

export type SubmitOrderDTO = {
  actor: AuthenticatedActor;
  orderId: string;
};

class SubmitOrderUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async execute({ actor, orderId }: SubmitOrderDTO): Promise<void> {
    void actor;

    const result = await this.ordersRepository.save(orderId, (currentOrder) => {
      if (currentOrder.status !== 'DRAFT') {
        throw new ConflictError('Only draft orders can be submitted.');
      }

      if (currentOrder.items.length === 0) {
        throw new ConflictError('An empty order cannot be submitted.');
      }

      currentOrder.submit(this.clock.now());
    });

    if (result.status === 'not-found') {
      throw new ResourceNotFoundError('Order not found.');
    }
  }
}

export { SubmitOrderUseCase };
