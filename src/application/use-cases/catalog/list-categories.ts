import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { CategoriesRepository } from '@/application/repositories/categories-repository';

export type ListCategoriesResult = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

class ListCategoriesUseCase {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async execute(actor: AuthenticatedActor): Promise<ListCategoriesResult[]> {
    void actor;

    const categories = await this.categoriesRepository.listAll();

    return categories.map((category) => {
      return {
        id: category.id,
        name: category.name,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      };
    });
  }
}
export { ListCategoriesUseCase };
