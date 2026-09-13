import type { Order } from '@/domain/entities/order';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { OrdersRepository } from '@/application/repositories/orders-repository';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

export type GetOrderDTO = {
  actor: AuthenticatedActor;
  orderId: string;
};

class GetOrderUseCase {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async execute({ actor, orderId }: GetOrderDTO): Promise<Order> {
    void actor;

    const order = await this.ordersRepository.findById(orderId);

    if (!order) {
      throw new ResourceNotFoundError('Order not found.');
    }

    return order;
  }
}

export { GetOrderUseCase };
