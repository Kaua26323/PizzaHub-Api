import type { Pool } from 'pg';
import { Product } from '@/domain/entities/product';
import type { ImageMimeTypeProps } from '@/domain/entities/product';

import type {
  ProductsRepository,
  ListProductsFilters,
} from '@/application/repositories/products-repository';

type ProductRow = {
  id: string;
  name: string;
  description: string;
  price: string;
  image_key: string;
  image_mime_type: ImageMimeTypeProps;
  image_size: number;
  is_active: boolean;
  category_id: string;
  created_at: Date;
  updated_at: Date;
};

function mapProductRow(row: ProductRow): Product {
  return new Product({
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    imageKey: row.image_key,
    imageMimeType: row.image_mime_type,
    imageSize: row.image_size,
    isActive: row.is_active,
    categoryId: row.category_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

class PostgresProductsRepository implements ProductsRepository {
  constructor(private readonly pool: Pool) {}

  async create(product: Product): Promise<void> {
    const {
      id,
      name,
      description,
      price,
      imageKey,
      imageMimeType,
      imageSize,
      isActive,
      categoryId,
      createdAt,
      updatedAt,
    } = product;

    await this.pool.query(
      `
        INSERT INTO products (
          id,
          name,
          description,
          price,
          image_key,
          image_mime_type,
          image_size,
          is_active,
          category_id,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11
        );
      `,
      [
        id,
        name,
        description,
        price,
        imageKey,
        imageMimeType,
        imageSize,
        isActive,
        categoryId,
        createdAt,
        updatedAt,
      ],
    );
  }

  async findById(productId: string): Promise<Product | null> {
    const queryResult = await this.pool.query<ProductRow>(
      `
        SELECT
          id,
          name,
          description,
          price,
          image_key,
          image_mime_type,
          image_size,
          is_active,
          category_id,
          created_at,
          updated_at
        FROM products
        WHERE id = $1;

      `,
      [productId],
    );

    const [row] = queryResult.rows;

    return row ? mapProductRow(row) : null;
  }

  async listAll(filters?: ListProductsFilters): Promise<Product[]> {
    const queryResult = filters
      ? await this.pool.query<ProductRow>(
          `
            SELECT
              id,
              name,
              description,
              price,
              image_key,
              image_mime_type,
              image_size,
              is_active,
              category_id,
              created_at,
              updated_at
            FROM products
            WHERE category_id = $1
            ORDER BY created_at;
          `,
          [filters.categoryId],
        )
      : await this.pool.query<ProductRow>(
          `
            SELECT
              id,
              name,
              description,
              price,
              image_key,
              image_mime_type,
              image_size,
              is_active,
              category_id,
              created_at,
              updated_at
            FROM products
            ORDER BY created_at;
        `,
        );

    return queryResult.rows.map((row) => mapProductRow(row));
  }

  async hasOrderHistory(productId: string): Promise<boolean> {
    const queryResult = await this.pool.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM order_items
          WHERE product_id = $1
        ) AS exists;
      `,
      [productId],
    );

    return queryResult.rows[0]?.exists ?? false;
  }

  async update(product: Product): Promise<void> {
    const {
      id,
      name,
      description,
      price,
      imageKey,
      imageMimeType,
      imageSize,
      isActive,
      categoryId,
      updatedAt,
    } = product;

    await this.pool.query(
      `
        UPDATE products
        SET
          name = $1,
          description = $2,
          price = $3,
          image_key = $4,
          image_mime_type = $5,
          image_size = $6,
          is_active = $7,
          category_id = $8,
          updated_at = $9
        WHERE id = $10;
      `,
      [
        name,
        description,
        price,
        imageKey,
        imageMimeType,
        imageSize,
        isActive,
        categoryId,
        updatedAt,
        id,
      ],
    );
  }

  async delete(productId: string): Promise<void> {
    await this.pool.query(
      `
        DELETE FROM products
        WHERE id = $1;
      `,
      [productId],
    );
  }
}

export { PostgresProductsRepository };
