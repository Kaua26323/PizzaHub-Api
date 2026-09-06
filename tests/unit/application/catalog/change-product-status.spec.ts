import { describe, expect, it, vi } from 'vitest';

import { Product } from '@/domain/entities/product';
import type { ProductProps } from '@/domain/entities/product';

import type { AuthenticatedActor } from '@/application/authenticated-actor';

import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import { ChangeProductStatusUseCase } from '@/application/use-cases/catalog/change-product-status';

import { InMemoryProductsRepository } from '@tests/doubles/repositories/in-memory-products-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const productsRepository = new InMemoryProductsRepository();

  const sut = new ChangeProductStatusUseCase(productsRepository);

  return {
    sut,
    productsRepository,
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
    imageKey: 'pizza.webp',
    imageMimeType: 'image/webp',
    imageSize: 5_000,
    categoryId: 'category-id',
    isActive: true,
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

describe('ChangeProductStatusUseCase', () => {
  it('should allow an ADMIN to deactivate an active product', async () => {
    const { sut, productsRepository } = makeSut();

    await productsRepository.create(
      makeProduct({
        isActive: true,
      }),
    );

    await sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      isActive: false,
    });

    const product = await productsRepository.findById('product-id');

    expect(product?.isActive).toBe(false);
  });

  it('should allow an ADMIN to activate an inactive product', async () => {
    const { sut, productsRepository } = makeSut();

    await productsRepository.create(
      makeProduct({
        isActive: false,
      }),
    );

    await sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      isActive: true,
    });

    const product = await productsRepository.findById('product-id');

    expect(product?.isActive).toBe(true);
  });

  it('should preserve the other product data when changing status', async () => {
    const { sut, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    await sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      isActive: false,
    });

    const product = await productsRepository.findById('product-id');

    expect(product).toMatchObject({
      id: 'product-id',
      name: 'Margherita',
      description: 'Tomato sauce, mozzarella and basil.',
      price: '39.90',
      imageKey: 'pizza.webp',
      imageMimeType: 'image/webp',
      imageSize: 5_000,
      categoryId: 'category-id',
      isActive: false,
      createdAt: currentDate,
    });
  });

  it('should reject status changes when the actor is not ADMIN', async () => {
    const { sut, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    const execution = sut.execute({
      actor: makeActor({
        role: 'STAFF',
      }),
      productId: 'product-id',
      isActive: false,
    });

    await expect(execution).rejects.toThrow(AuthorizationError);

    const product = await productsRepository.findById('product-id');

    expect(product?.isActive).toBe(true);
  });

  it('should reject status changes when the product does not exist', async () => {
    const { sut, productsRepository } = makeSut();

    const execution = sut.execute({
      actor: makeActor(),
      productId: 'missing-product-id',
      isActive: false,
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Product not found.');

    expect(productsRepository.products).toHaveLength(0);
  });

  it('should not persist when the product already has the requested active status', async () => {
    const { sut, productsRepository } = makeSut();

    await productsRepository.create(
      makeProduct({
        isActive: true,
      }),
    );

    const updateSpy = vi.spyOn(productsRepository, 'update');

    await sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      isActive: true,
    });

    expect(updateSpy).not.toHaveBeenCalled();

    const product = await productsRepository.findById('product-id');

    expect(product?.isActive).toBe(true);
  });

  it('should not persist when the product already has the requested inactive status', async () => {
    const { sut, productsRepository } = makeSut();

    await productsRepository.create(
      makeProduct({
        isActive: false,
      }),
    );

    const updateSpy = vi.spyOn(productsRepository, 'update');

    await sut.execute({
      actor: makeActor(),
      productId: 'product-id',
      isActive: false,
    });

    expect(updateSpy).not.toHaveBeenCalled();

    const product = await productsRepository.findById('product-id');

    expect(product?.isActive).toBe(false);
  });
});
