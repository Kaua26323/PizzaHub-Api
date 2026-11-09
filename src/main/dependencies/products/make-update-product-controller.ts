import { UpdateProductUseCase } from '@/application/use-cases/catalog/update-product';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { PostgresCategoriesRepository } from '@/infrastructure/database/postgres/repositories/postgres-categories-repository';
import { PostgresProductsRepository } from '@/infrastructure/database/postgres/repositories/postgres-products-repository';
import { LocalImageStorage } from '@/infrastructure/storage/local-image-storage';
import { UpdateProductController } from '@/presentation/http/controllers/catalog/products/update-product-controller';
import type { ProductMultipartOptions } from '@/presentation/http/controllers/catalog/products/product-multipart-options';

export function makeUpdateProductController(
  options: ProductMultipartOptions,
  permanentDirectory: string,
): UpdateProductController {
  const imageStorage = new LocalImageStorage({
    temporaryDirectory: options.temporaryFilePath,
    permanentDirectory,
  });
  const productsRepository = new PostgresProductsRepository(pool);
  const categoriesRepository = new PostgresCategoriesRepository(pool);

  const updateProductUseCase = new UpdateProductUseCase(
    imageStorage,
    productsRepository,
    categoriesRepository,
  );

  return new UpdateProductController(updateProductUseCase, options);
}
