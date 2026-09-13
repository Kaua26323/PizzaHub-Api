import type { Order } from '@/domain/entities/order';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type {
  OrdersRepository,
  ListOrdersFilters,
} from '@/application/repositories/orders-repository';

export type ListOrdersDTO = {
  actor: AuthenticatedActor;
  filters?: ListOrdersFilters;
};

export type ListOrdersResult = Order[];

class ListOrdersUseCase {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async execute({ actor, filters }: ListOrdersDTO): Promise<ListOrdersResult> {
    void actor;

    const orders = await this.ordersRepository.listAll(filters);

    return orders;
  }
}

export { ListOrdersUseCase };
