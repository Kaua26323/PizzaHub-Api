import { describe, expect, it } from 'vitest';

import { Product } from '@/domain/entities/product';
import type { ProductProps } from '@/domain/entities/product';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { ListProductsUseCase } from '@/application/use-cases/catalog/list-products';

import { InMemoryProductsRepository } from '@tests/doubles/repositories/in-memory-products-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const productsRepository = new InMemoryProductsRepository();

  const sut = new ListProductsUseCase(productsRepository);

  return { sut, productsRepository };
}
function makeProduct(overrides: Partial<ProductProps> = {}): Product {
  return new Product({
    id: 'product-id-1',
    name: 'Four-cheese pizza',
    description: 'A good pizza',
    price: '80.00',
    imageKey: 'dadnadjasn-132112312as',
    imageMimeType: 'image/png',
    imageSize: 5_000,
    categoryId: 'pizza-id',
    isActive: true,
    createdAt: currentDate,
    updatedAt: currentDate,
    ...overrides,
  });
}

function makeActor(overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    id: 'user-id',
    role: 'ADMIN',
    ...overrides,
  };
}
describe('ListProductsUseCase', () => {
  it('should return a products array when the actor is ADMIN', async () => {
    const { sut, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    const products = await sut.execute({ actor: makeActor() });

    expect(products).toHaveLength(1);
    expect(products[0]).toEqual({
      id: 'product-id-1',
      name: 'Four-cheese pizza',
      description: 'A good pizza',
      price: '80.00',
      imageKey: 'dadnadjasn-132112312as',
      imageMimeType: 'image/png',
      imageSize: 5_000,
      categoryId: 'pizza-id',
      isActive: true,
      createdAt: currentDate,
      updatedAt: currentDate,
    });
  });

  it('should return a products array when the actor is STAFF', async () => {
    const { sut, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    const products = await sut.execute({ actor: makeActor({ role: 'STAFF' }) });

    expect(products).toHaveLength(1);
    expect(products[0]).toEqual({
      id: 'product-id-1',
      name: 'Four-cheese pizza',
      description: 'A good pizza',
      price: '80.00',
      imageKey: 'dadnadjasn-132112312as',
      imageMimeType: 'image/png',
      imageSize: 5_000,
      categoryId: 'pizza-id',
      isActive: true,
      createdAt: currentDate,
      updatedAt: currentDate,
    });
  });

  it('should return products from every category when no filter is provided', async () => {
    const { sut, productsRepository } = makeSut();

    await productsRepository.create(
      makeProduct({
        id: 'pizza-product',
        categoryId: 'pizza-category',
      }),
    );

    await productsRepository.create(
      makeProduct({
        id: 'drink-product',
        name: 'Cola',
        categoryId: 'drink-category',
      }),
    );

    const products = await sut.execute({
      actor: makeActor({ role: 'STAFF' }),
    });

    expect(products.map((product) => product.id)).toEqual([
      'pizza-product',
      'drink-product',
    ]);
  });

  it('should filter products explicitly by categoryId', async () => {
    const { sut, productsRepository } = makeSut();

    await productsRepository.create(
      makeProduct({
        id: 'pizza-product',
        categoryId: 'pizza-category',
      }),
    );

    await productsRepository.create(
      makeProduct({
        id: 'drink-product',
        name: 'Cola',
        categoryId: 'drink-category',
      }),
    );

    const products = await sut.execute({
      actor: makeActor(),
      filters: {
        categoryId: 'drink-category',
      },
    });

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      id: 'drink-product',
      name: 'Cola',
      categoryId: 'drink-category',
    });
  });

  it('should return both active and inactive products', async () => {
    const { sut, productsRepository } = makeSut();

    await productsRepository.create(makeProduct());

    await productsRepository.create(
      makeProduct({
        id: 'product-id-2',
        name: 'Pepperoni pizza',
        isActive: false,
      }),
    );

    const products = await sut.execute({
      actor: makeActor(),
    });

    expect(products).toHaveLength(2);

    expect(products[0]).toMatchObject({
      id: 'product-id-1',
      name: 'Four-cheese pizza',
      isActive: true,
    });

    expect(products[1]).toMatchObject({
      id: 'product-id-2',
      name: 'Pepperoni pizza',
      isActive: false,
    });
  });

  it('should return an empty array when there are no products', async () => {
    const { sut } = makeSut();

    const products = await sut.execute({
      actor: makeActor(),
    });

    expect(products).toHaveLength(0);
  });
});
