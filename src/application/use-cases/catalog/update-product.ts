import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';
import type { ProductsRepository } from '@/application/repositories/products-repository';
import type { CategoriesRepository } from '@/application/repositories/categories-repository';
import type {
  ImageStorage,
  StoredImage,
  TemporaryImage,
} from '@/application/services/image-storage';

export type UpdateProductDTO = {
  actor: AuthenticatedActor;
  productId: string;
  changes: {
    categoryId?: string;
    name?: string;
    description?: string;
    price?: string;
  };
  image?: TemporaryImage;
};

class UpdateProductUseCase {
  constructor(
    private readonly imageStorage: ImageStorage,

    private readonly productsRepository: ProductsRepository,
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  async execute({ actor, productId, changes, image }: UpdateProductDTO): Promise<void> {
    let storedImage: StoredImage | null = null;
    let oldImageKey: string | null = null;

    try {
      if (actor.role !== 'ADMIN') {
        throw new AuthorizationError();
      }

      const productToUpdate = await this.productsRepository.findById(productId);

      if (!productToUpdate) {
        throw new ResourceNotFoundError('Product not found.');
      }

      if (changes.categoryId !== undefined) {
        const category = await this.categoriesRepository.findById(changes.categoryId);

        if (!category) {
          throw new ResourceNotFoundError('Category not found.');
        }

        productToUpdate.changeCategory(category.id);
      }

      if (changes.name !== undefined) {
        productToUpdate.changeName(changes.name);
      }

      if (changes.description !== undefined) {
        productToUpdate.changeDescription(changes.description);
      }

      if (changes.price !== undefined) {
        productToUpdate.changePrice(changes.price);
      }

      if (image) {
        oldImageKey = productToUpdate.imageKey;

        storedImage = await this.imageStorage.finalize(image);

        productToUpdate.changeImage(
          storedImage.key,
          storedImage.mimeType,
          storedImage.size,
        );
      }

      await this.productsRepository.update(productToUpdate);
    } catch (error) {
      if (image) {
        await this.imageStorage.delete(storedImage?.key ?? image.key);
      }

      throw error;
    }

    if (storedImage && oldImageKey) {
      await this.imageStorage.delete(oldImageKey);
    }
  }
}

export { UpdateProductUseCase };
