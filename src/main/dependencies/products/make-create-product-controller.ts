import { CreateProductUseCase } from '@/application/use-cases/catalog/create-product';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { PostgresCategoriesRepository } from '@/infrastructure/database/postgres/repositories/postgres-categories-repository';
import { PostgresProductsRepository } from '@/infrastructure/database/postgres/repositories/postgres-products-repository';
import { NodeIdGenerator } from '@/infrastructure/identifiers/node-id-generator';
import { LocalImageStorage } from '@/infrastructure/storage/local-image-storage';
import { SystemClock } from '@/infrastructure/time/system-clock';
import { CreateProductController } from '@/presentation/http/controllers/catalog/products/create-product-controller';
import type { ProductMultipartOptions } from '@/presentation/http/controllers/catalog/products/product-multipart-options';

export function makeCreateProductController(
  options: ProductMultipartOptions,
  permanentDirectory: string,
): CreateProductController {
  const clock = new SystemClock();
  const idGenerator = new NodeIdGenerator();
  const imageStorage = new LocalImageStorage({
    temporaryDirectory: options.temporaryFilePath,
    permanentDirectory,
  });
  const productsRepository = new PostgresProductsRepository(pool);
  const categoriesRepository = new PostgresCategoriesRepository(pool);

  const createProductUseCase = new CreateProductUseCase(
    clock,
    idGenerator,
    imageStorage,
    productsRepository,
    categoriesRepository,
  );

  return new CreateProductController(createProductUseCase, options);
}
