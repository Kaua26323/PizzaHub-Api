import { describe, expect, it, vi } from 'vitest';

import { Product } from '@/domain/entities/product';
import type { ProductProps } from '@/domain/entities/product';
import { Category } from '@/domain/entities/category';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { InvalidProductError } from '@/domain/errors/invalid-product-error';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import type { TemporaryImage } from '@/application/services/image-storage';
import { UpdateProductUseCase } from '@/application/use-cases/catalog/update-product';

import { FakeImageStorage } from '@tests/doubles/services/fake-image-storage';
import { InMemoryProductsRepository } from '@tests/doubles/repositories/in-memory-products-repository';
import { InMemoryCategoriesRepository } from '@tests/doubles/repositories/in-memory-categories-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const imageStorage = new FakeImageStorage();

  const productsRepository = new InMemoryProductsRepository();
  const categoriesRepository = new InMemoryCategoriesRepository();

  const sut = new UpdateProductUseCase(
    imageStorage,
    productsRepository,
    categoriesRepository,
  );

  return {
    sut,
    imageStorage,
    productsRepository,
    categoriesRepository,
  };
}

function makeActor(overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    id: 'admin-user-id',
    role: 'ADMIN',
    ...overrides,
  };
}

function makeProduct(overrides: Partial<ProductProps> = {}): Product {
  return new Product({
    id: 'product-id',
    name: 'Margherita',
    description: 'Tomato sauce, mozzarella and basil.',
    price: '39.90',
    imageKey: 'old-image.webp',
    imageMimeType: 'image/webp',
    imageSize: 4_000,
    categoryId: 'category-id',
    isActive: true,
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

function makeCategory(
  overrides: Partial<{
    id: string;
    name: string;
  }> = {},
): Category {
  return new Category({
    id: 'category-id',
    name: 'Pizzas',
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

function makeImage(): TemporaryImage {
  return {
    key: 'temporary-image.webp',
    mimeType: 'image/webp',
    size: 5_000,
  };
}

describe('UpdateProductUseCase', () => {
  it('should update the provided product fields when the actor is ADMIN', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    await sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      changes: {
        name: 'Pepperoni',
        description: 'Pepperoni and mozzarella.',
        price: '49.90',
      },
    });

    const product = await productsRepository.findById('product-id');

    expect(product).toMatchObject({
      id: 'product-id',
      name: 'Pepperoni',
      description: 'Pepperoni and mozzarella.',
      price: '49.90',

      // unchanged
      categoryId: 'category-id',
      imageKey: 'old-image.webp',
      imageMimeType: 'image/webp',
      imageSize: 4_000,
      isActive: true,
    });

    expect(imageStorage.finalizedImages).toHaveLength(0);
    expect(imageStorage.deletedKeys).toHaveLength(0);
  });

  it('should update the product category when the target category exists', async () => {
    const { sut, productsRepository, categoriesRepository } = makeSut();

    await productsRepository.create(makeProduct());

    await categoriesRepository.create(
      makeCategory({
        id: 'new-category-id',
        name: 'Premium Pizzas',
      }),
    );

    await sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      changes: {
        categoryId: 'new-category-id',
      },
    });

    const product = await productsRepository.findById('product-id');

    expect(product?.categoryId).toBe('new-category-id');
  });

  it('should reject product update when the actor is not ADMIN', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    const execution = sut.execute({
      actor: makeActor({
        role: 'STAFF',
      }),
      productId: 'product-id',
      changes: {
        name: 'Pepperoni',
      },
      image: makeImage(),
    });

    await expect(execution).rejects.toThrow(AuthorizationError);

    expect(imageStorage.finalizedImages).toHaveLength(0);
    expect(imageStorage.deletedKeys).toEqual(['temporary-image.webp']);

    const product = await productsRepository.findById('product-id');

    expect(product?.name).toBe('Margherita');
  });

  it('should reject update when the product does not exist', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    const execution = sut.execute({
      actor: makeActor(),
      productId: 'missing-product-id',
      changes: {
        name: 'Pepperoni',
      },
      image: makeImage(),
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Product not found.');

    expect(imageStorage.finalizedImages).toHaveLength(0);
    expect(imageStorage.deletedKeys).toEqual(['temporary-image.webp']);
    expect(productsRepository.products).toHaveLength(0);
  });

  it('should reject update when the target category does not exist', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    const execution = sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      changes: {
        categoryId: 'missing-category-id',
      },
      image: makeImage(),
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Category not found.');

    expect(imageStorage.finalizedImages).toHaveLength(0);
    expect(imageStorage.deletedKeys).toEqual(['temporary-image.webp']);
  });

  it('should let the domain reject invalid provided product data', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    const execution = sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      changes: {
        name: '',
      },
      image: makeImage(),
    });

    await expect(execution).rejects.toThrow(InvalidProductError);

    expect(imageStorage.finalizedImages).toHaveLength(0);
    expect(imageStorage.deletedKeys).toEqual(['temporary-image.webp']);

    const product = await productsRepository.findById('product-id');

    expect(product?.name).toBe('Margherita');
  });

  it('should replace the product image and delete the old image after a successful update', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    await sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      changes: {},
      image: makeImage(),
    });

    expect(imageStorage.finalizedImages).toEqual([
      {
        key: 'temporary-image.webp',
        mimeType: 'image/webp',
        size: 5_000,
      },
    ]);

    const product = await productsRepository.findById('product-id');

    expect(product).toMatchObject({
      imageKey: 'stored/temporary-image.webp',
      imageMimeType: 'image/webp',
      imageSize: 5_000,
    });

    expect(imageStorage.deletedKeys).toEqual(['old-image.webp']);
  });

  it('should delete the temporary image when image finalization fails', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    vi.spyOn(imageStorage, 'finalize').mockRejectedValueOnce(
      new Error('Image finalization failed.'),
    );

    const execution = sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      changes: {},
      image: makeImage(),
    });

    await expect(execution).rejects.toThrow('Image finalization failed.');

    expect(imageStorage.finalizedImages).toHaveLength(0);
    expect(imageStorage.deletedKeys).toEqual(['temporary-image.webp']);

    const product = await productsRepository.findById('product-id');

    expect(product?.imageKey).toBe('old-image.webp');
  });

  it('should delete the new stored image when product persistence fails', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    vi.spyOn(productsRepository, 'update').mockRejectedValueOnce(
      new Error('Product persistence failed.'),
    );

    const execution = sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      changes: {},
      image: makeImage(),
    });

    await expect(execution).rejects.toThrow('Product persistence failed.');

    expect(imageStorage.finalizedImages).toHaveLength(1);
    expect(imageStorage.deletedKeys).toEqual(['stored/temporary-image.webp']);
    expect(imageStorage.deletedKeys).not.toContain('old-image.webp');
  });

  it('should not delete the new image when old-image cleanup fails after persistence succeeds', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    const deleteSpy = vi
      .spyOn(imageStorage, 'delete')
      .mockRejectedValueOnce(new Error('Old image cleanup failed.'));

    const execution = sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      changes: {},
      image: makeImage(),
    });

    await expect(execution).rejects.toThrow('Old image cleanup failed.');

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith('old-image.webp');

    const product = await productsRepository.findById('product-id');

    expect(product?.imageKey).toBe('stored/temporary-image.webp');
  });
});
