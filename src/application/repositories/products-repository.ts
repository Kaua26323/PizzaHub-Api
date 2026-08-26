import type { Product } from '@/domain/entities/product';

export type ListProductsFilters = {
  categoryId: string;
};

export type ProductsRepository = {
  create(product: Product): Promise<void>;
  findById(productId: string): Promise<Product | null>;
  listAll(filters?: ListProductsFilters): Promise<Product[]>;
  hasOrderHistory(productId: string): Promise<boolean>;
  update(product: Product): Promise<void>;
  delete(productId: string): Promise<void>;
};
