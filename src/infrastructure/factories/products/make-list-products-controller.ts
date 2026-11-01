import { ListProductsUseCase } from '@/application/use-cases/catalog/list-products';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { PostgresProductsRepository } from '@/infrastructure/database/postgres/repositories/postgres-products-repository';
import { ListProductsController } from '@/presentation/http/controllers/catalog/products/list-products-controller';

export function makeListProductsController(): ListProductsController {
  const productsRepository = new PostgresProductsRepository(pool);

  const listProductsUseCase = new ListProductsUseCase(productsRepository);

  return new ListProductsController(listProductsUseCase);
}
