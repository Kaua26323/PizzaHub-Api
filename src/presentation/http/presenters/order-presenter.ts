import type { Order } from '@/domain/entities/order';
import type { OrderResponseDTO } from '@/presentation/http/controllers/dtos/orders/order-response-dto';

export function presentOrder(order: Order): OrderResponseDTO {
  return {
    id: order.id,
    tableNumber: order.tableNumber,
    customerName: order.customerName,
    status: order.status,
    items: order.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
      notes: item.notes,
    })),
    total: order.total,
    createdByUserId: order.createdByUserId,
    createdAt: order.createdAt.toISOString(),
    submittedAt: order.submittedAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
  };
}
