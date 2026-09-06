import { describe, expect, it, vi } from 'vitest';

import { Product } from '@/domain/entities/product';
import type { ProductProps } from '@/domain/entities/product';

import type { AuthenticatedActor } from '@/application/authenticated-actor';

import { ConflictError } from '@/application/errors/conflict-error';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

import { DeleteProductUseCase } from '@/application/use-cases/catalog/delete-product';

import { FakeImageStorage } from '@tests/doubles/services/fake-image-storage';
import { InMemoryProductsRepository } from '@tests/doubles/repositories/in-memory-products-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const imageStorage = new FakeImageStorage();
  const productsRepository = new InMemoryProductsRepository();

  const sut = new DeleteProductUseCase(imageStorage, productsRepository);

  return {
    sut,
    imageStorage,
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
    imageKey: 'product-image.webp',
    imageMimeType: 'image/webp',
    imageSize: 5_000,
    categoryId: 'category-id',
    isActive: true,
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

describe('DeleteProductUseCase', () => {
  it('should allow an ADMIN to permanently delete a product without order history', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    vi.spyOn(productsRepository, 'hasOrderHistory').mockResolvedValueOnce(false);

    await sut.execute({
      actor: makeActor(),
      productId: 'product-id',
    });

    const product = await productsRepository.findById('product-id');

    expect(product).toBeNull();
    expect(imageStorage.deletedKeys).toEqual(['product-image.webp']);
  });

  it('should reject deletion when the actor is not ADMIN', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    const deleteSpy = vi.spyOn(productsRepository, 'delete');

    const execution = sut.execute({
      actor: makeActor({
        role: 'STAFF',
      }),
      productId: 'product-id',
    });

    await expect(execution).rejects.toThrow(AuthorizationError);

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(imageStorage.deletedKeys).toHaveLength(0);

    const product = await productsRepository.findById('product-id');

    expect(product).not.toBeNull();
  });

  it('should reject deletion when the product does not exist', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    const deleteSpy = vi.spyOn(productsRepository, 'delete');

    const execution = sut.execute({
      actor: makeActor(),
      productId: 'missing-product-id',
    });

    await expect(execution).rejects.toThrow(ResourceNotFoundError);
    await expect(execution).rejects.toThrow('Product not found.');

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(imageStorage.deletedKeys).toHaveLength(0);
  });

  it('should reject permanent deletion when the product has order history', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    vi.spyOn(productsRepository, 'hasOrderHistory').mockResolvedValueOnce(true);

    const deleteSpy = vi.spyOn(productsRepository, 'delete');

    const execution = sut.execute({
      actor: makeActor(),
      productId: 'product-id',
    });

    await expect(execution).rejects.toThrow(ConflictError);
    await expect(execution).rejects.toThrow(
      'Product with order history cannot be deleted.',
    );

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(imageStorage.deletedKeys).toHaveLength(0);

    const product = await productsRepository.findById('product-id');

    expect(product).not.toBeNull();
  });

  it('should not delete the product image when permanent deletion fails', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    vi.spyOn(productsRepository, 'hasOrderHistory').mockResolvedValueOnce(false);

    vi.spyOn(productsRepository, 'delete').mockRejectedValueOnce(
      new Error('Product persistence deletion failed.'),
    );

    const execution = sut.execute({
      actor: makeActor(),
      productId: 'product-id',
    });

    await expect(execution).rejects.toThrow('Product persistence deletion failed.');

    expect(imageStorage.deletedKeys).toHaveLength(0);

    const product = await productsRepository.findById('product-id');

    expect(product).not.toBeNull();
  });

  it('should delete the stored image only after permanent product deletion succeeds', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    vi.spyOn(productsRepository, 'hasOrderHistory').mockResolvedValueOnce(false);

    const repositoryDeleteSpy = vi.spyOn(productsRepository, 'delete');

    const imageDeleteSpy = vi.spyOn(imageStorage, 'delete');

    await sut.execute({
      actor: makeActor(),
      productId: 'product-id',
    });

    expect(repositoryDeleteSpy).toHaveBeenCalledWith('product-id');
    expect(imageDeleteSpy).toHaveBeenCalledWith('product-image.webp');
    expect(repositoryDeleteSpy.mock.invocationCallOrder[0]).toBeLessThan(
      imageDeleteSpy.mock.invocationCallOrder[0] as number,
    );
  });

  it('should surface image cleanup failures without restoring the deleted product', async () => {
    const { sut, imageStorage, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    vi.spyOn(productsRepository, 'hasOrderHistory').mockResolvedValueOnce(false);

    vi.spyOn(imageStorage, 'delete').mockRejectedValueOnce(
      new Error('Image cleanup failed.'),
    );

    const execution = sut.execute({
      actor: makeActor(),
      productId: 'product-id',
    });

    await expect(execution).rejects.toThrow('Image cleanup failed.');

    const product = await productsRepository.findById('product-id');

    expect(product).toBeNull();
  });
});
