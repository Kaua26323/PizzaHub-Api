import { describe, expect, it } from 'vitest';

import { InvalidOrderError } from '@/domain/errors/invalid-order-error';

import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { CreateOrderUseCase } from '@/application/use-cases/orders/create-order';

import { FakeClock } from '@tests/doubles/services/fake-clock';
import { FakeIdGenerator } from '@tests/doubles/services/fake-id-generator';
import { InMemoryOrdersRepository } from '@tests/doubles/repositories/in-memory-orders-repository';

const currentDate = new Date('2026-01-01T00:00:00.000Z');

function makeSut() {
  const clock = new FakeClock(currentDate);
  const idGenerator = new FakeIdGenerator(['order-1']);
  const ordersRepository = new InMemoryOrdersRepository();

  const sut = new CreateOrderUseCase(clock, idGenerator, ordersRepository);

  return { sut, clock, idGenerator, ordersRepository };
}

function makeActor(overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    id: 'user-id',
    role: 'ADMIN',
    ...overrides,
  };
}

describe('CreateOrderUseCase', () => {
  it('should allow an ADMIN to create a draft order', async () => {
    const { sut, idGenerator, ordersRepository } = makeSut();

    await sut.execute({
      actor: makeActor(),
      tableNumber: 1,
      customerName: 'Kauan',
    });

    expect(ordersRepository.orders).toHaveLength(1);

    const order = ordersRepository.orders[0];

    expect(order?.id).toBe('order-1');
    expect(order?.tableNumber).toBe(1);
    expect(order?.customerName).toBe('Kauan');
    expect(order?.createdByUserId).toBe('user-id');
    expect(order?.status).toBe('DRAFT');
    expect(order?.items).toEqual([]);
    expect(order?.createdAt).toEqual(currentDate);

    expect(order?.submittedAt).toBeNull();
    expect(order?.completedAt).toBeNull();
    expect(order?.cancelledAt).toBeNull();

    expect(order?.total).toBe('0.00');

    expect(idGenerator.generatedIds).toEqual(['order-1']);
  });

  it('should allow a STAFF to create an order without a customer name', async () => {
    const { sut, ordersRepository } = makeSut();

    await sut.execute({
      actor: makeActor({
        role: 'STAFF',
      }),
      tableNumber: 1,
    });

    expect(ordersRepository.orders).toHaveLength(1);

    const order = ordersRepository.orders[0];

    expect(order?.createdByUserId).toBe('user-id');
    expect(order?.customerName).toBeNull();
    expect(order?.status).toBe('DRAFT');
  });

  it('should reject order creation without a table number', async () => {
    const { sut, ordersRepository } = makeSut();

    const execution = sut.execute({
      actor: makeActor(),
      tableNumber: undefined as unknown as number,
    });

    await expect(execution).rejects.toThrow(InvalidOrderError);

    expect(ordersRepository.orders).toHaveLength(0);
  });

  it('should reject invalid table number data', async () => {
    const { sut, ordersRepository } = makeSut();

    await expect(
      sut.execute({
        actor: makeActor(),
        tableNumber: NaN,
      }),
    ).rejects.toThrow(InvalidOrderError);

    await expect(
      sut.execute({
        actor: makeActor(),
        tableNumber: 'invalid' as unknown as number,
      }),
    ).rejects.toThrow(InvalidOrderError);

    expect(ordersRepository.orders).toHaveLength(0);
  });
});
