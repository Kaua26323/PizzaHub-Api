import type { Order } from '@/domain/entities/order';
import type { OrderStatus } from '@/domain/enums/order-status';

export type ListOrdersFilters = {
  status: OrderStatus;
};

export type SaveOrderResult = { status: 'saved' } | { status: 'not-found' };

export type OrderChange = (order: Order) => void;

export type OrderTransitionResult = { status: 'applied' } | { status: 'not-applied' };

export type OrdersRepository = {
  create(order: Order): Promise<void>;
  findById(orderId: string): Promise<Order | null>;
  listAll(filters?: ListOrdersFilters): Promise<Order[]>;
  save(orderId: string, change: OrderChange): Promise<SaveOrderResult>;
  complete(order: Order): Promise<OrderTransitionResult>;
  cancel(order: Order): Promise<OrderTransitionResult>;
};
