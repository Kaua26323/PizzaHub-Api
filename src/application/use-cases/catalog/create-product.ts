import { Product } from '@/domain/entities/product';

import type { Clock } from '@/application/services/clock';
import type { IdGenerator } from '@/application/services/id-generator';
import type {
  ImageStorage,
  StoredImage,
  TemporaryImage,
} from '@/application/services/image-storage';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { ProductsRepository } from '@/application/repositories/products-repository';
import type { CategoriesRepository } from '@/application/repositories/categories-repository';

import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

export type ProductData = {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  isActive: boolean;
};

export type CreateProductDTO = {
  actor: AuthenticatedActor;
  product: ProductData;
  image: TemporaryImage;
};

class CreateProductUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly imageStorage: ImageStorage,

    private readonly productsRepository: ProductsRepository,
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  async execute({ actor, product, image }: CreateProductDTO): Promise<void> {
    let storedImage: StoredImage | null = null;

    try {
      if (actor.role !== 'ADMIN') {
        throw new AuthorizationError();
      }

      const category = await this.categoriesRepository.findById(product.categoryId);

      if (!category) {
        throw new ResourceNotFoundError('Category not found.');
      }

      const now = this.clock.now();
      const productId = this.idGenerator.generate();

      const candidateProduct = new Product({
        id: productId,
        name: product.name,
        description: product.description,
        categoryId: product.categoryId,
        price: product.price,
        isActive: product.isActive,
        imageKey: image.key,
        imageSize: image.size,
        imageMimeType: image.mimeType,

        createdAt: now,
        updatedAt: now,
      });

      storedImage = await this.imageStorage.finalize(image);

      const productToPersist = new Product({
        id: candidateProduct.id,
        name: candidateProduct.name,
        description: candidateProduct.description,
        categoryId: candidateProduct.categoryId,
        price: candidateProduct.price,
        isActive: candidateProduct.isActive,
        imageKey: storedImage.key,
        imageSize: storedImage.size,
        imageMimeType: storedImage.mimeType,
        createdAt: candidateProduct.createdAt,
        updatedAt: candidateProduct.updatedAt,
      });

      await this.productsRepository.create(productToPersist);
    } catch (error) {
      await this.imageStorage.delete(storedImage?.key ?? image.key);

      throw error;
    }
  }
}

export { CreateProductUseCase };
