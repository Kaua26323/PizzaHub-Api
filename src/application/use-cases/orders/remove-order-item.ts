import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { OrdersRepository } from '@/application/repositories/orders-repository';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

export type RemoveOrderItemDTO = {
  actor: AuthenticatedActor;
  orderId: string;
  itemId: string;
};

class RemoveOrderItemUseCase {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async execute({ actor, orderId, itemId }: RemoveOrderItemDTO): Promise<void> {
    void actor;

    const result = await this.ordersRepository.save(orderId, (currentOrder) => {
      if (currentOrder.status !== 'DRAFT') {
        throw new ConflictError(
          'ORDER_STATE_CONFLICT',
          'Only draft orders can remove items.',
        );
      }

      const itemExists = currentOrder.items.some((item) => item.id === itemId);

      if (!itemExists) {
        throw new ResourceNotFoundError('ORDER_ITEM_NOT_FOUND', 'Order item not found.');
      }

      currentOrder.removeItem(itemId);
    });

    if (result.status === 'not-found') {
      throw new ResourceNotFoundError('ORDER_NOT_FOUND', 'Order not found.');
    }
  }
}
export { RemoveOrderItemUseCase };
