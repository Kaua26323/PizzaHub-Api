import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { OrdersRepository } from '@/application/repositories/orders-repository';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

export type UpdateOrderItemDTO = {
  actor: AuthenticatedActor;
  orderId: string;
  itemId: string;
  changes: {
    quantity?: number;
    notes?: string | null;
  };
};

class UpdateOrderItemUseCase {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async execute({ actor, orderId, itemId, changes }: UpdateOrderItemDTO): Promise<void> {
    void actor;

    const result = await this.ordersRepository.save(orderId, (currentOrder) => {
      if (currentOrder.status !== 'DRAFT') {
        throw new ConflictError('Only draft orders can update items.');
      }

      const itemExists = currentOrder.items.some((item) => item.id === itemId);

      if (!itemExists) {
        throw new ResourceNotFoundError('Order item not found.');
      }

      if (changes.notes !== undefined) {
        currentOrder.changeItemNotes(itemId, changes.notes);
      }

      if (changes.quantity !== undefined) {
        currentOrder.changeItemQuantity(itemId, changes.quantity);
      }
    });

    if (result.status === 'not-found') {
      throw new ResourceNotFoundError('Order not found.');
    }
  }
}
export { UpdateOrderItemUseCase };
