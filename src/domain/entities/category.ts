import { InvalidCategoryError } from '../errors/invalid-category-error';

export interface CategoryProps {
  id: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class Category {
  private readonly _id: string;
  private _name: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(data: CategoryProps) {
    Category.validate(data);

    this._id = data.id;
    this._name = data.name.trim();

    const now = new Date();
    this._createdAt = data.createdAt ? new Date(data.createdAt.getTime()) : now;
    this._updatedAt = data.updatedAt ? new Date(data.updatedAt.getTime()) : now;
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  public rename(newName: string): void {
    Category.validateName(newName);

    this._name = newName.trim();
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static validateName(name: string): void {
    if (name.trim().length === 0) {
      throw new InvalidCategoryError('Name is required.');
    }
  }

  private static validate(data: CategoryProps): void {
    if (data.id.length === 0 || data.id !== data.id.trim()) {
      throw new InvalidCategoryError('ID is invalid.');
    }

    Category.validateName(data.name);

    if (data.createdAt && !Number.isFinite(data.createdAt.getTime())) {
      throw new InvalidCategoryError('createdAt must be a valid date.');
    }

    if (data.updatedAt && !Number.isFinite(data.updatedAt.getTime())) {
      throw new InvalidCategoryError('updatedAt must be a valid date.');
    }
  }
}

export { Category };
