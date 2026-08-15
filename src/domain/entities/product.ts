import { Money } from '../value-objects/money';
import { InvalidProductError } from '../errors/invalid-product-error';

export interface ProductProps {
  id: string;
  name: string;
  description: string;
  price: string;
  imageKey: string;
  imageMimeType: ImageMimeTypeProps;
  imageSize: number;
  categoryId: string;

  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageMimeTypeProps = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

class Product {
  private readonly _id: string;
  private _name: string;
  private _description: string;
  private _price: Money;
  private _imageKey: string;
  private _imageMimeType: ImageMimeTypeProps;
  private _imageSize: number;
  private _categoryId: string;

  private _isActive: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(data: ProductProps) {
    Product.validate(data);

    this._id = data.id;
    this._name = data.name.trim();
    this._description = data.description.trim();
    this._price = new Money(data.price);
    this._imageKey = data.imageKey.trim();
    this._imageMimeType = data.imageMimeType;
    this._imageSize = data.imageSize;
    this._categoryId = data.categoryId;
    this._isActive = data.isActive;

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
  get description(): string {
    return this._description;
  }
  get price(): string {
    return this._price.value;
  }
  get imageKey(): string {
    return this._imageKey;
  }
  get imageMimeType(): ImageMimeTypeProps {
    return this._imageMimeType;
  }
  get imageSize(): number {
    return this._imageSize;
  }
  get categoryId(): string {
    return this._categoryId;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }
  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  public changeName(newName: string): void {
    Product.validateName(newName);

    this._name = newName.trim();
    this.touch();
  }

  public changeDescription(newText: string) {
    Product.validateDescription(newText);

    this._description = newText.trim();
    this.touch();
  }

  public changeImage(
    imageKey: string,
    imageMimeType: ImageMimeTypeProps,
    imageSize: number,
  ) {
    Product.validateImage(imageKey, imageMimeType, imageSize);

    this._imageKey = imageKey.trim();
    this._imageMimeType = imageMimeType;
    this._imageSize = imageSize;

    this.touch();
  }

  public changePrice(newValue: string): void {
    this._price = new Money(newValue);
    this.touch();
  }

  public changeCategory(newCategoryId: string): void {
    Product.validateCategoryId(newCategoryId);

    this._categoryId = newCategoryId;
    this.touch();
  }

  public activate(): void {
    if (this._isActive) {
      return;
    }

    this._isActive = true;
    this.touch();
  }

  public deactivate(): void {
    if (!this._isActive) {
      return;
    }

    this._isActive = false;
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static validateName(name: string): void {
    if (name.trim().length === 0) {
      throw new InvalidProductError('Name is required.');
    }
  }

  private static validateDescription(text: string): void {
    if (text.trim().length === 0) {
      throw new InvalidProductError('Description is required.');
    }

    if (text.trim().length > 500) {
      throw new InvalidProductError('Description must not exceed 500 characters.');
    }
  }

  private static validateImageKey(imageKey: string): void {
    const normalizedKey = imageKey.trim();

    if (normalizedKey.length === 0) {
      throw new InvalidProductError('imageKey is required.');
    }

    const isUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(normalizedKey);
    const isUnixAbsolutePath = normalizedKey.startsWith('/');
    const isWindowsAbsolutePath = /^[a-zA-Z]:[\\/]/.test(normalizedKey);

    if (isUrl || isUnixAbsolutePath || isWindowsAbsolutePath) {
      throw new InvalidProductError('imageKey must be storage-neutral.');
    }
  }

  private static validateImage(
    imageKey: string,
    imageMimeType: ImageMimeTypeProps,
    imageSize: number,
  ): void {
    Product.validateImageKey(imageKey);

    if (!imageMimeType || !ALLOWED_IMAGE_MIME_TYPES.includes(imageMimeType)) {
      throw new InvalidProductError('imageMimeType is invalid.');
    }

    if (!Number.isSafeInteger(imageSize) || imageSize <= 0) {
      throw new InvalidProductError('imageSize must be a positive integer.');
    }
  }

  private static validateCategoryId(categoryId: string): void {
    if (categoryId.length === 0 || categoryId !== categoryId.trim()) {
      throw new InvalidProductError('categoryId is invalid.');
    }
  }

  private static validate(data: ProductProps): void {
    if (data.id.length === 0 || data.id !== data.id.trim()) {
      throw new InvalidProductError('ID is invalid.');
    }

    Product.validateName(data.name);
    Product.validateDescription(data.description);
    Product.validateImage(data.imageKey, data.imageMimeType, data.imageSize);
    Product.validateCategoryId(data.categoryId);

    if (typeof data.isActive !== 'boolean') {
      throw new InvalidProductError('isActive must be a boolean.');
    }

    if (data.createdAt && !Number.isFinite(data.createdAt.getTime())) {
      throw new InvalidProductError('createdAt must be a valid date.');
    }
    if (data.updatedAt && !Number.isFinite(data.updatedAt.getTime())) {
      throw new InvalidProductError('updatedAt must be a valid date.');
    }
  }
}

export { Product };
