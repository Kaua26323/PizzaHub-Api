import type { ImageMimeTypeProps } from '@/domain/entities/product';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type {
  ProductsRepository,
  ListProductsFilters,
} from '@/application/repositories/products-repository';

export type ListProductsDTO = {
  actor: AuthenticatedActor;
  filters?: ListProductsFilters;
};

export type ListedProduct = {
  id: string;
  name: string;
  description: string;
  price: string;
  imageKey: string;
  imageMimeType: ImageMimeTypeProps;
  imageSize: number;
  categoryId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ListProductsResult = ListedProduct[];

class ListProductsUseCase {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async execute({ actor, filters }: ListProductsDTO): Promise<ListProductsResult> {
    void actor;

    const products = await this.productsRepository.listAll(filters);

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      imageKey: product.imageKey,
      imageMimeType: product.imageMimeType,
      imageSize: product.imageSize,
      categoryId: product.categoryId,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));
  }
}

export { ListProductsUseCase };
