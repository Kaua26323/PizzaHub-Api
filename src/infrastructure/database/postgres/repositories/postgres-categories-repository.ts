import type { Pool } from 'pg';
import { Category } from '@/domain/entities/category';
import type { CategoriesRepository } from '@/application/repositories/categories-repository';

type CategoryRow = {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
};

function mapCategoryRow(row: CategoryRow): Category {
  return new Category({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

class PostgresCategoriesRepository implements CategoriesRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: Category): Promise<void> {
    const { id, name, createdAt, updatedAt } = data;

    await this.pool.query(
      `
      INSERT INTO categories (
        id,
        name,
        created_at,
        updated_at
      )
      VALUES($1, $2, $3, $4);
    `,
      [id, name, createdAt, updatedAt],
    );
  }

  async listAll(): Promise<Category[]> {
    const queryResult = await this.pool.query<CategoryRow>(`
      SELECT id, name, created_at, updated_at
      FROM categories
      ORDER BY created_at;
    `);

    return queryResult.rows.map((row) => mapCategoryRow(row));
  }

  async findById(categoryId: string): Promise<Category | null> {
    const queryResult = await this.pool.query<CategoryRow>(
      `
      SELECT id, name, created_at, updated_at
      FROM categories
      WHERE id = $1;
    `,
      [categoryId],
    );

    const [row] = queryResult.rows;

    return row ? mapCategoryRow(row) : null;
  }

  async findByName(name: string): Promise<Category | null> {
    const queryResult = await this.pool.query<CategoryRow>(
      `
      SELECT id, name, created_at, updated_at
      FROM categories
      WHERE name = $1;
     `,
      [name],
    );

    const [row] = queryResult.rows;

    return row ? mapCategoryRow(row) : null;
  }

  async hasProducts(categoryId: string): Promise<boolean> {
    const queryResult = await this.pool.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1 
          FROM products
          WHERE category_id = $1 
        ) AS exists;
    `,
      [categoryId],
    );

    return queryResult.rows[0]?.exists ?? false;
  }

  async rename(category: Category): Promise<void> {
    const { id, name, updatedAt } = category;

    await this.pool.query(
      `
        UPDATE categories 
        SET
          name = $1,
          updated_at = $2
        WHERE id = $3; 
    `,
      [name, updatedAt, id],
    );
  }

  async delete(categoryId: string): Promise<void> {
    await this.pool.query(
      `
        DELETE FROM categories
        WHERE id = $1;
    `,
      [categoryId],
    );
  }
}

export { PostgresCategoriesRepository };
