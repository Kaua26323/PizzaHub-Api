import type { Pool, PoolClient } from 'pg';

import { Order } from '@/domain/entities/order';
import { OrderItem } from '@/domain/entities/order-item';
import type { OrderStatus } from '@/domain/enums/order-status';

import { withTransaction } from '@/infrastructure/database/postgres/connection/transaction';

import type {
  OrderChange,
  SaveOrderResult,
  OrdersRepository,
  ListOrdersFilters,
} from '@/application/repositories/orders-repository';

type OrderRow = {
  id: string;
  table_number: number;
  customer_name: string | null;
  status: OrderStatus;
  created_by_user_id: string;
  created_at: Date;
  submitted_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: string;
  quantity: number;
  notes: string | null;
};

type JoinedOrderItemRow = {
  order_item_id: string | null;
  order_id: string | null;
  product_id: string | null;
  product_name: string | null;
  unit_price: string | null;
  quantity: number | null;
  notes: string | null;
};

type OrderQueryRow = OrderRow & JoinedOrderItemRow;

function mapOrderItemRow(row: OrderItemRow): OrderItem {
  return new OrderItem({
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    unitPrice: row.unit_price,
    quantity: row.quantity,
    notes: row.notes,
  });
}

function mapJoinedOrderItemRow(row: OrderQueryRow): OrderItem | null {
  if (row.order_item_id === null) {
    return null;
  }

  if (
    row.order_id === null ||
    row.product_id === null ||
    row.product_name === null ||
    row.unit_price === null ||
    row.quantity === null
  ) {
    throw new Error('Invalid order item row returned by PostgreSQL.');
  }

  return new OrderItem({
    id: row.order_item_id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    unitPrice: row.unit_price,
    quantity: row.quantity,
    notes: row.notes,
  });
}

function mapOrderRow(row: OrderRow, items: readonly OrderItem[]): Order {
  return Order.restore({
    id: row.id,
    tableNumber: row.table_number,
    customerName: row.customer_name,
    status: row.status,
    items,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
  });
}

function compareDates(first: Date | null, second: Date | null): boolean {
  if (first === null || second === null) {
    return first === second;
  }

  return first.getTime() === second.getTime();
}

function hasLifecycleChanged(original: Order, changed: Order): boolean {
  return (
    original.status !== changed.status ||
    !compareDates(original.submittedAt, changed.submittedAt) ||
    !compareDates(original.completedAt, changed.completedAt) ||
    !compareDates(original.cancelledAt, changed.cancelledAt)
  );
}

type OrderItemsDiff = {
  added: OrderItem[];
  removed: OrderItem[];
  modified: OrderItem[];
};

function compareOrderItems(
  oldItems: readonly OrderItem[],
  newItems: readonly OrderItem[],
): OrderItemsDiff {
  const oldItemsById = new Map(oldItems.map((item) => [item.id, item]));

  const newItemsById = new Map(newItems.map((item) => [item.id, item]));

  const added = newItems.filter((item) => !oldItemsById.has(item.id));

  const removed = oldItems.filter((item) => !newItemsById.has(item.id));

  const modified = newItems.filter((newItem) => {
    const oldItem = oldItemsById.get(newItem.id);

    if (!oldItem) {
      return false;
    }

    return oldItem.quantity !== newItem.quantity || oldItem.notes !== newItem.notes;
  });

  return {
    added,
    removed,
    modified,
  };
}

class PostgresOrdersRepository implements OrdersRepository {
  constructor(private readonly pool: Pool) {}

  async create(order: Order): Promise<void> {
    const {
      id,
      tableNumber,
      customerName,
      status,
      createdByUserId,
      createdAt,
      submittedAt,
      completedAt,
      cancelledAt,
    } = order;

    await this.pool.query(
      `
        INSERT INTO orders (
          id,
          table_number,
          customer_name,
          status,
          created_by_user_id,
          created_at,
          submitted_at,
          completed_at,
          cancelled_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9
        );
      `,
      [
        id,
        tableNumber,
        customerName,
        status,
        createdByUserId,
        createdAt,
        submittedAt,
        completedAt,
        cancelledAt,
      ],
    );
  }

  async findById(orderId: string): Promise<Order | null> {
    const result = await this.pool.query<OrderQueryRow>(
      `
          SELECT
            o.id,
            o.table_number,
            o.customer_name,
            o.status,
            o.created_by_user_id,
            o.created_at,
            o.submitted_at,
            o.completed_at,
            o.cancelled_at,

            oi.id AS order_item_id,
            oi.order_id,
            oi.product_id,
            oi.product_name,
            oi.unit_price,
            oi.quantity,
            oi.notes
          FROM orders AS o
          LEFT JOIN order_items AS oi
            ON oi.order_id = o.id
          WHERE o.id = $1
          ORDER BY oi.id;
        `,
      [orderId],
    );

    const orderRow = result.rows[0];

    if (!orderRow) {
      return null;
    }

    const items = result.rows.flatMap((row) => {
      const item = mapJoinedOrderItemRow(row);

      return item ? [item] : [];
    });

    return mapOrderRow(orderRow, items);
  }

  async listAll(filters?: ListOrdersFilters): Promise<Order[]> {
    const result = filters
      ? await this.pool.query<OrderQueryRow>(
          `
              SELECT
                o.id,
                o.table_number,
                o.customer_name,
                o.status,
                o.created_by_user_id,
                o.created_at,
                o.submitted_at,
                o.completed_at,
                o.cancelled_at,

                oi.id AS order_item_id,
                oi.order_id,
                oi.product_id,
                oi.product_name,
                oi.unit_price,
                oi.quantity,
                oi.notes
              FROM orders AS o
              LEFT JOIN order_items AS oi
                ON oi.order_id = o.id
              WHERE o.status = $1
              ORDER BY
                o.created_at,
                o.id,
                oi.id;
            `,
          [filters.status],
        )
      : await this.pool.query<OrderQueryRow>(
          `
              SELECT
                o.id,
                o.table_number,
                o.customer_name,
                o.status,
                o.created_by_user_id,
                o.created_at,
                o.submitted_at,
                o.completed_at,
                o.cancelled_at,

                oi.id AS order_item_id,
                oi.order_id,
                oi.product_id,
                oi.product_name,
                oi.unit_price,
                oi.quantity,
                oi.notes
              FROM orders AS o
              LEFT JOIN order_items AS oi
                ON oi.order_id = o.id
              ORDER BY
                o.created_at,
                o.id,
                oi.id;
            `,
        );

    const groupedOrders = new Map<
      string,
      {
        row: OrderRow;
        items: OrderItem[];
      }
    >();

    for (const row of result.rows) {
      let current = groupedOrders.get(row.id);

      if (!current) {
        current = {
          row,
          items: [],
        };

        groupedOrders.set(row.id, current);
      }

      const orderItem = mapJoinedOrderItemRow(row);

      if (orderItem) {
        current.items.push(orderItem);
      }
    }

    return Array.from(groupedOrders.values(), ({ row, items }) =>
      mapOrderRow(row, items),
    );
  }

  async save(orderId: string, change: OrderChange): Promise<SaveOrderResult> {
    return withTransaction(this.pool, async (client) => {
      const orderResult = await client.query<OrderRow>(
        `
              SELECT
                id,
                table_number,
                customer_name,
                status,
                created_by_user_id,
                created_at,
                submitted_at,
                completed_at,
                cancelled_at
              FROM orders
              WHERE id = $1
              FOR UPDATE;
            `,
        [orderId],
      );

      const orderRow = orderResult.rows[0];

      if (!orderRow) {
        return {
          status: 'not-found',
        };
      }

      const itemsResult = await client.query<OrderItemRow>(
        `
              SELECT
                id,
                order_id,
                product_id,
                product_name,
                unit_price,
                quantity,
                notes
              FROM order_items
              WHERE order_id = $1
              ORDER BY id
              FOR UPDATE;
            `,
        [orderId],
      );

      const oldItems = itemsResult.rows.map(mapOrderItemRow);

      const originalOrder = mapOrderRow(orderRow, oldItems);

      const changedOrder = mapOrderRow(orderRow, oldItems);

      change(changedOrder);

      const itemChanges = compareOrderItems(oldItems, changedOrder.items);

      if (hasLifecycleChanged(originalOrder, changedOrder)) {
        const updateResult = await client.query(
          `
              UPDATE orders
              SET
                status = $1,
                submitted_at = $2,
                completed_at = $3,
                cancelled_at = $4
              WHERE id = $5
                AND status = $6;
            `,
          [
            changedOrder.status,
            changedOrder.submittedAt,
            changedOrder.completedAt,
            changedOrder.cancelledAt,
            orderId,
            originalOrder.status,
          ],
        );

        if (updateResult.rowCount !== 1) {
          throw new Error('Order state changed unexpectedly while saving.');
        }
      }

      await this.persistRemovedItems(client, itemChanges.removed);
      await this.persistModifiedItems(client, itemChanges.modified);
      await this.persistAddedItems(client, itemChanges.added);

      return {
        status: 'saved',
      };
    });
  }

  private async persistAddedItems(
    client: PoolClient,
    items: readonly OrderItem[],
  ): Promise<void> {
    for (const item of items) {
      await client.query(
        `
          INSERT INTO order_items (
            id,
            order_id,
            product_id,
            product_name,
            unit_price,
            quantity,
            notes
          )
          VALUES (
            $1, $2, $3, $4,
            $5, $6, $7
          );
        `,
        [
          item.id,
          item.orderId,
          item.productId,
          item.productName,
          item.unitPrice,
          item.quantity,
          item.notes,
        ],
      );
    }
  }

  private async persistRemovedItems(
    client: PoolClient,
    items: readonly OrderItem[],
  ): Promise<void> {
    for (const item of items) {
      await client.query(
        `
          DELETE FROM order_items
          WHERE id = $1
            AND order_id = $2;
        `,
        [item.id, item.orderId],
      );
    }
  }

  private async persistModifiedItems(
    client: PoolClient,
    items: readonly OrderItem[],
  ): Promise<void> {
    for (const item of items) {
      await client.query(
        `
          UPDATE order_items
          SET
            quantity = $1,
            notes = $2
          WHERE id = $3
            AND order_id = $4;
        `,
        [item.quantity, item.notes, item.id, item.orderId],
      );
    }
  }
}

export { PostgresOrdersRepository };
