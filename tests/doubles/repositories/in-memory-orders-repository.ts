import { Order } from '@/domain/entities/order';

import type {
  OrderChange,
  SaveOrderResult,
  OrdersRepository,
  ListOrdersFilters,
} from '@/application/repositories/orders-repository';

function cloneOrder(order: Order): Order {
  return Order.restore({
    id: order.id,
    tableNumber: order.tableNumber,
    customerName: order.customerName,
    status: order.status,
    items: order.items,
    createdByUserId: order.createdByUserId,
    createdAt: order.createdAt,
    submittedAt: order.submittedAt,
    completedAt: order.completedAt,
    cancelledAt: order.cancelledAt,
  });
}

class InMemoryOrdersRepository implements OrdersRepository {
  public readonly orders: Order[] = [];

  async create(order: Order): Promise<void> {
    this.orders.push(cloneOrder(order));
  }

  async findById(orderId: string): Promise<Order | null> {
    const order = this.orders.find((item) => item.id === orderId);

    return order ? cloneOrder(order) : null;
  }

  async listAll(filters?: ListOrdersFilters): Promise<Order[]> {
    const orders = filters
      ? this.orders.filter((order) => order.status === filters.status)
      : this.orders;

    return orders.map(cloneOrder);
  }

  async save(orderId: string, change: OrderChange): Promise<SaveOrderResult> {
    const index = this.orders.findIndex((order) => order.id === orderId);
    const persistedOrder = index === -1 ? undefined : this.orders[index];

    if (!persistedOrder) return { status: 'not-found' };

    const changedOrder = cloneOrder(persistedOrder);
    change(changedOrder);
    this.orders[index] = changedOrder;

    return { status: 'saved' };
  }
}

export { InMemoryOrdersRepository };
