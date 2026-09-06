import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import type { ProductsRepository } from '@/application/repositories/products-repository';

export type ChangeProductStatusDTO = {
  actor: AuthenticatedActor;
  productId: string;
  isActive: boolean;
};

class ChangeProductStatusUseCase {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async execute({ actor, productId, isActive }: ChangeProductStatusDTO): Promise<void> {
    if (actor.role !== 'ADMIN') {
      throw new AuthorizationError();
    }

    const product = await this.productsRepository.findById(productId);

    if (!product) {
      throw new ResourceNotFoundError('Product not found.');
    }

    if (product.isActive === isActive) return;

    if (isActive) {
      product.activate();
    } else {
      product.deactivate();
    }

    await this.productsRepository.update(product);
  }
}

export { ChangeProductStatusUseCase };
