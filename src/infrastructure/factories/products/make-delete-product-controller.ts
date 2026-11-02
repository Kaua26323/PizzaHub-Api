import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { LocalImageStorage } from '@/infrastructure/storage/local-image-storage';
import { DeleteProductUseCase } from '@/application/use-cases/catalog/delete-product';
import { DeleteProductController } from '@/presentation/http/controllers/catalog/products/delete-product-controller';
import { PostgresProductsRepository } from '@/infrastructure/database/postgres/repositories/postgres-products-repository';

export function makeDeleteProductController(
  temporaryDirectory: string,
  permanentDirectory: string,
): DeleteProductController {
  const productsRepository = new PostgresProductsRepository(pool);
  const imageStorage = new LocalImageStorage({
    temporaryDirectory,
    permanentDirectory,
  });

  const deleteProductUseCase = new DeleteProductUseCase(imageStorage, productsRepository);

  return new DeleteProductController(deleteProductUseCase);
}
