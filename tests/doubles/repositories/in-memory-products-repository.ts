import type {
  ListProductsFilters,
  ProductsRepository,
} from '@/application/repositories/products-repository';
import { Product } from '@/domain/entities/product';

function cloneProduct(product: Product): Product {
  return new Product({
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
  });
}

class InMemoryProductsRepository implements ProductsRepository {
  public readonly products: Product[] = [];
  public readonly productIdsWithOrderHistory = new Set<string>();

  async create(product: Product): Promise<void> {
    this.products.push(cloneProduct(product));
  }

  async findById(productId: string): Promise<Product | null> {
    const product = this.products.find((item) => item.id === productId);

    return product ? cloneProduct(product) : null;
  }

  async listAll(filters?: ListProductsFilters): Promise<Product[]> {
    const products = filters
      ? this.products.filter((product) => product.categoryId === filters.categoryId)
      : this.products;

    return products.map(cloneProduct);
  }

  async hasOrderHistory(productId: string): Promise<boolean> {
    return this.productIdsWithOrderHistory.has(productId);
  }

  async update(product: Product): Promise<void> {
    const index = this.products.findIndex((item) => item.id === product.id);

    if (index === -1) return;

    this.products[index] = cloneProduct(product);
  }

  async delete(productId: string): Promise<void> {
    const index = this.products.findIndex((product) => product.id === productId);

    if (index === -1) return;

    this.products.splice(index, 1);
    this.productIdsWithOrderHistory.delete(productId);
  }
}

export { InMemoryProductsRepository };
