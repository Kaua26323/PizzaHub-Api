import type { OrderStatus } from '@/domain/enums/order-status';

export type OrderItemResponseDTO = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  unitPrice: string;
  quantity: number;
  subtotal: string;
  notes: string | null;
};

export type OrderResponseDTO = {
  id: string;
  tableNumber: number;
  customerName: string | null;
  status: OrderStatus;
  items: OrderItemResponseDTO[];
  total: string;
  createdByUserId: string;
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};
