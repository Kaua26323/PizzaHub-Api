import type { AuthenticatedActor } from '@/application/authenticated-actor';

import { ConflictError } from '@/application/errors/conflict-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import type { IdGenerator } from '@/application/services/id-generator';
import type { OrdersRepository } from '@/application/repositories/orders-repository';
import type { ProductsRepository } from '@/application/repositories/products-repository';

export type AddOrderItemDTO = {
  actor: AuthenticatedActor;
  orderId: string;
  productId: string;
  item: {
    notes?: string | null;
    quantity: number;
  };
};

class AddOrderItemUseCase {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly productsRepository: ProductsRepository,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async execute({ actor, orderId, productId, item }: AddOrderItemDTO): Promise<void> {
    void actor;

    const order = await this.ordersRepository.findById(orderId);

    if (!order) {
      throw new ResourceNotFoundError('Order not found.');
    }

    if (order.status !== 'DRAFT') {
      throw new ConflictError('Only draft orders can have items added.');
    }

    const product = await this.productsRepository.findById(productId);

    if (!product) {
      throw new ResourceNotFoundError('Product not found.');
    }

    if (!product.isActive) {
      throw new ConflictError('Inactive products cannot be added to an order.');
    }

    const result = await this.ordersRepository.save(orderId, (currentOrder) => {
      if (currentOrder.status !== 'DRAFT') {
        throw new ConflictError('Only draft orders can have items added.');
      }

      currentOrder.addItem({
        id: this.idGenerator.generate(),
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: item.quantity,
        notes: item.notes ?? null,
      });
    });

    if (result.status === 'not-found') {
      throw new ResourceNotFoundError('Order not found.');
    }
  }
}
export { AddOrderItemUseCase };
