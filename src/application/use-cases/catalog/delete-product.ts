import { ConflictError } from '@/application/errors/conflict-error';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import type { ImageStorage } from '@/application/services/image-storage';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { ProductsRepository } from '@/application/repositories/products-repository';

export type DeleteProductDTO = {
  actor: AuthenticatedActor;
  productId: string;
};

class DeleteProductUseCase {
  constructor(
    private readonly imageStorage: ImageStorage,
    private readonly productsRepository: ProductsRepository,
  ) {}

  async execute({ actor, productId }: DeleteProductDTO): Promise<void> {
    if (actor.role !== 'ADMIN') {
      throw new AuthorizationError();
    }

    const product = await this.productsRepository.findById(productId);

    if (!product) {
      throw new ResourceNotFoundError('Product not found.');
    }

    const orderHistory = await this.productsRepository.hasOrderHistory(productId);

    if (orderHistory) {
      throw new ConflictError('Product with order history cannot be deleted.');
    }

    await this.productsRepository.delete(productId);

    await this.imageStorage.delete(product.imageKey);
  }
}

export { DeleteProductUseCase };
