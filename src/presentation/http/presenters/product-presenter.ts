import type { ListedProduct } from '@/application/use-cases/catalog/list-products';
import type { ProductResponseDTO } from '@/presentation/http/controllers/dtos/catalog/products/product-response-dto';

export function presentProduct(product: ListedProduct): ProductResponseDTO {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    categoryId: product.categoryId,
    isActive: product.isActive,
    imageUrl: `/images/products/${encodeURIComponent(product.imageKey)}`,
    imageSize: product.imageSize,
    imageMimeType: product.imageMimeType,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
