import { describe, expect, it, vi } from 'vitest';

import { Category } from '@/domain/entities/category';
import { InvalidProductError } from '@/domain/errors/invalid-product-error';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import type { ProductData } from '@/application/use-cases/catalog/create-product';
import { CreateProductUseCase } from '@/application/use-cases/catalog/create-product';

import { FakeClock } from '@tests/doubles/services/fake-clock';
import { FakeIdGenerator } from '@tests/doubles/services/fake-id-generator';
import { FakeImageStorage } from '@tests/doubles/services/fake-image-storage';
import { InMemoryProductsRepository } from '@tests/doubles/repositories/in-memory-products-repository';
import { InMemoryCategoriesRepository } from '@tests/doubles/repositories/in-memory-categories-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const clock = new FakeClock(currentDate);
  const imageStorage = new FakeImageStorage();
  const idGenerator = new FakeIdGenerator(['product-id']);
  const productsRepository = new InMemoryProductsRepository();
  const categoriesRepository = new InMemoryCategoriesRepository();

  const sut = new CreateProductUseCase(
    clock,
    idGenerator,
    imageStorage,
    productsRepository,
    categoriesRepository,
  );

  return {
    sut,
    clock,
    idGenerator,
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

function makeProductData(overrides: Partial<ProductData> = {}): ProductData {
  return {
    name: 'Margherita',
    description: 'Tomato sauce, mozzarella and basil.',
    price: '39.90',
    categoryId: 'category-id',
    isActive: true,
    ...overrides,
  };
}

function makeImage() {
  return {
    key: 'temporary-image.webp',
    mimeType: 'image/webp' as const,
    size: 5_000,
  };
}

function makeCategory(): Category {
  return new Category({
    id: 'category-id',
    name: 'Pizzas',
    createdAt: currentDate,
    updatedAt: currentDate,
  });
}

describe('CreateProductUseCase', () => {
  it('should create a product when the actor is ADMIN', async () => {
    const { sut, imageStorage, productsRepository, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    await sut.execute({
      actor: makeActor(),
      product: makeProductData(),
      image: makeImage(),
    });

    expect(imageStorage.finalizedImages).toEqual([
      {
        key: 'temporary-image.webp',
        mimeType: 'image/webp',
        size: 5_000,
      },
    ]);

    expect(productsRepository.products).toHaveLength(1);

    expect(productsRepository.products[0]).toMatchObject({
      id: 'product-id',
      name: 'Margherita',
      description: 'Tomato sauce, mozzarella and basil.',
      price: '39.90',
      categoryId: 'category-id',
      isActive: true,
      imageKey: 'stored/temporary-image.webp',
      imageMimeType: 'image/webp',
      imageSize: 5_000,
      createdAt: currentDate,
      updatedAt: currentDate,
    });

    expect(imageStorage.deletedKeys).toHaveLength(0);
  });

  it('should reject product creation when the actor is not ADMIN', async () => {
    const { sut, idGenerator, imageStorage, productsRepository } = makeSut();

    const execution = sut.execute({
      actor: makeActor({ role: 'STAFF' }),
      product: makeProductData(),
      image: makeImage(),
    });

    await expect(execution).rejects.toThrow(AuthorizationError);

    expect(idGenerator.generatedIds).toHaveLength(0);
    expect(imageStorage.finalizedImages).toHaveLength(0);
    expect(imageStorage.deletedKeys).toEqual(['temporary-image.webp']);
    expect(productsRepository.products).toHaveLength(0);
  });

  it('should reject product creation when the category does not exist', async () => {
    const { sut, idGenerator, imageStorage, productsRepository } = makeSut();

    const execution = sut.execute({
      actor: makeActor(),
      product: makeProductData(),
      image: makeImage(),
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Category not found.');

    expect(idGenerator.generatedIds).toHaveLength(0);
    expect(imageStorage.finalizedImages).toHaveLength(0);
    expect(imageStorage.deletedKeys).toEqual(['temporary-image.webp']);
    expect(productsRepository.products).toHaveLength(0);
  });

  it('should delete the temporary image when the product data is invalid', async () => {
    const { sut, imageStorage, productsRepository, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    const execution = sut.execute({
      actor: makeActor(),
      product: makeProductData({
        name: ' ',
      }),
      image: makeImage(),
    });

    await expect(execution).rejects.toThrow(InvalidProductError);

    expect(imageStorage.finalizedImages).toHaveLength(0);
    expect(imageStorage.deletedKeys).toEqual(['temporary-image.webp']);
    expect(productsRepository.products).toHaveLength(0);
  });

  it('should delete the temporary image when image finalization fails', async () => {
    const { sut, imageStorage, productsRepository, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    vi.spyOn(imageStorage, 'finalize').mockRejectedValueOnce(
      new Error('Image finalization failed.'),
    );

    const execution = sut.execute({
      actor: makeActor(),
      product: makeProductData(),
      image: makeImage(),
    });

    await expect(execution).rejects.toThrow('Image finalization failed.');

    expect(imageStorage.finalizedImages).toHaveLength(0);
    expect(imageStorage.deletedKeys).toEqual(['temporary-image.webp']);
    expect(productsRepository.products).toHaveLength(0);
  });

  it('should delete the finalized image when product persistence fails', async () => {
    const { sut, imageStorage, productsRepository, categoriesRepository } = makeSut();

    await categoriesRepository.create(makeCategory());

    vi.spyOn(productsRepository, 'create').mockRejectedValueOnce(
      new Error('Product persistence failed.'),
    );

    const execution = sut.execute({
      actor: makeActor(),
      product: makeProductData(),
      image: makeImage(),
    });

    await expect(execution).rejects.toThrow('Product persistence failed.');

    expect(imageStorage.finalizedImages).toHaveLength(1);
    expect(imageStorage.deletedKeys).toEqual(['stored/temporary-image.webp']);
    expect(imageStorage.storedImages).toHaveLength(0);
    expect(productsRepository.products).toHaveLength(0);
  });
});
