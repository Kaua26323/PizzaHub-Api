import type { CategoriesRepository } from '@/application/repositories/categories-repository';
import { Category } from '@/domain/entities/category';

function cloneCategory(category: Category): Category {
  return new Category({
    id: category.id,
    name: category.name,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  });
}

class InMemoryCategoriesRepository implements CategoriesRepository {
  public readonly categories: Category[] = [];
  public readonly categoryIdsWithProducts = new Set<string>();

  async create(category: Category): Promise<void> {
    this.categories.push(cloneCategory(category));
  }

  async listAll(): Promise<Category[]> {
    return this.categories.map(cloneCategory);
  }

  async findById(categoryId: string): Promise<Category | null> {
    const category = this.categories.find((item) => item.id === categoryId);

    return category ? cloneCategory(category) : null;
  }

  async findByName(name: string): Promise<Category | null> {
    const normalizedName = name.trim();
    const category = this.categories.find((item) => item.name === normalizedName);

    return category ? cloneCategory(category) : null;
  }

  async hasProducts(categoryId: string): Promise<boolean> {
    return this.categoryIdsWithProducts.has(categoryId);
  }

  async rename(category: Category): Promise<void> {
    const index = this.categories.findIndex((item) => item.id === category.id);

    if (index === -1) return;

    this.categories[index] = cloneCategory(category);
  }

  async delete(categoryId: string): Promise<void> {
    const index = this.categories.findIndex((category) => category.id === categoryId);

    if (index === -1) return;

    this.categories.splice(index, 1);
    this.categoryIdsWithProducts.delete(categoryId);
  }
}

export { InMemoryCategoriesRepository };
