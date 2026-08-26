import type { Category } from '@/domain/entities/category';

export type CategoriesRepository = {
  create(data: Category): Promise<void>;
  listAll(): Promise<Category[]>;
  findById(categoryId: string): Promise<Category | null>;
  findByName(name: string): Promise<Category | null>;
  hasProducts(categoryId: string): Promise<boolean>;
  rename(category: Category): Promise<void>;
  delete(categoryId: string): Promise<void>;
};
