import { OrderItem } from './order-item';
import { InvalidOrderError } from '../errors/invalid-order-error';
import type { OrderStatus } from '../enums/order-status';
import { Money } from '../value-objects/money';

export interface OrderProps {
  id: string;
  tableNumber: number;
  customerName?: string | null;
  createdByUserId: string;
  createdAt?: Date;
}

export interface AddOrderItemProps {
  id: string;
  productId: string;
  productName: string;
  unitPrice: string;
  quantity: number;
  notes?: string | null;
}

export interface RestoreOrderProps {
  id: string;
  tableNumber: number;
  customerName?: string | null;
  status: OrderStatus;
  items: readonly OrderItem[];
  createdByUserId: string;
  createdAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
}

interface OrderState {
  id: string;
  tableNumber: number;
  customerName: string | null;
  status: OrderStatus;
  items: OrderItem[];
  createdByUserId: string;
  createdAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
}

class Order {
  private readonly _id: string;
  private readonly _tableNumber: number;
  private readonly _customerName: string | null;
  private _status: OrderStatus;
  private readonly _items: OrderItem[];
  private readonly _createdByUserId: string;
  private readonly _createdAt: Date;
  private _submittedAt: Date | null;
  private _completedAt: Date | null;
  private _cancelledAt: Date | null;

  private constructor(state: OrderState) {
    this._id = state.id;
    this._tableNumber = state.tableNumber;
    this._customerName = state.customerName;
    this._status = state.status;
    this._items = state.items;
    this._createdByUserId = state.createdByUserId;

    this._createdAt = new Date(state.createdAt.getTime());

    this._submittedAt = state.submittedAt ? new Date(state.submittedAt.getTime()) : null;

    this._completedAt = state.completedAt ? new Date(state.completedAt.getTime()) : null;

    this._cancelledAt = state.cancelledAt ? new Date(state.cancelledAt.getTime()) : null;
  }

  public static create(data: OrderProps): Order {
    Order.validateBaseData(data);

    const createdAt = data.createdAt ? new Date(data.createdAt.getTime()) : new Date();

    return new Order({
      id: data.id,
      tableNumber: data.tableNumber,
      customerName: Order.normalizeCustomerName(data.customerName),
      status: 'DRAFT',
      items: [],
      createdByUserId: data.createdByUserId,
      createdAt,
      submittedAt: null,
      completedAt: null,
      cancelledAt: null,
    });
  }

  public static restore(data: RestoreOrderProps): Order {
    Order.validateBaseData(data);
    Order.validateStatus(data.status);

    Order.validateDate(data.createdAt, 'createdAt');
    Order.validateOptionalDate(data.submittedAt, 'submittedAt');
    Order.validateOptionalDate(data.completedAt, 'completedAt');
    Order.validateOptionalDate(data.cancelledAt, 'cancelledAt');

    Order.validateLifecycle({
      status: data.status,
      submittedAt: data.submittedAt,
      completedAt: data.completedAt,
      cancelledAt: data.cancelledAt,
    });

    const items = Order.cloneAndValidateItems(data.id, data.items);

    if (data.submittedAt !== null && items.length === 0) {
      throw new InvalidOrderError('A submitted order must contain at least one item.');
    }

    return new Order({
      id: data.id,
      tableNumber: data.tableNumber,
      customerName: Order.normalizeCustomerName(data.customerName),
      status: data.status,
      items,
      createdByUserId: data.createdByUserId,
      createdAt: data.createdAt,
      submittedAt: data.submittedAt,
      completedAt: data.completedAt,
      cancelledAt: data.cancelledAt,
    });
  }

  get id(): string {
    return this._id;
  }

  get tableNumber(): number {
    return this._tableNumber;
  }

  get customerName(): string | null {
    return this._customerName;
  }

  get status(): OrderStatus {
    return this._status;
  }

  get items(): readonly OrderItem[] {
    return this._items.map((item) => Order.cloneItem(item));
  }

  get createdByUserId(): string {
    return this._createdByUserId;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get submittedAt(): Date | null {
    return this._submittedAt ? new Date(this._submittedAt.getTime()) : null;
  }

  get completedAt(): Date | null {
    return this._completedAt ? new Date(this._completedAt.getTime()) : null;
  }

  get cancelledAt(): Date | null {
    return this._cancelledAt ? new Date(this._cancelledAt.getTime()) : null;
  }

  get total(): string {
    let total: Money | null = null;

    for (const item of this._items) {
      const subtotal = new Money(item.subtotal);

      total = total ? total.add(subtotal) : subtotal;
    }

    return total?.value ?? '0.00';
  }

  public addItem(data: AddOrderItemProps): void {
    this.ensureDraft();

    if (this._items.some((item) => item.id === data.id)) {
      throw new InvalidOrderError('Order item ID already exists.');
    }

    const item = new OrderItem({
      id: data.id,
      orderId: this._id,
      productId: data.productId,
      productName: data.productName,
      unitPrice: data.unitPrice,
      quantity: data.quantity,
      notes: data.notes ?? null,
    });

    this._items.push(item);
  }

  public changeItemQuantity(itemId: string, newQuantity: number): void {
    this.ensureDraft();

    const item = this.findItem(itemId);

    item.changeQuantity(newQuantity);
  }

  public changeItemNotes(itemId: string, newNotes: string | null): void {
    this.ensureDraft();

    const item = this.findItem(itemId);

    item.changeNotes(newNotes);
  }

  public removeItem(itemId: string): void {
    this.ensureDraft();

    const itemIndex = this._items.findIndex((item) => item.id === itemId);

    if (itemIndex === -1) {
      throw new InvalidOrderError('Order item not found.');
    }

    this._items.splice(itemIndex, 1);
  }

  public submit(at: Date): void {
    if (this._status !== 'DRAFT') {
      throw new InvalidOrderError('Only draft orders can be submitted.');
    }

    if (this._items.length === 0) {
      throw new InvalidOrderError('An order must contain at least one item.');
    }

    Order.validateDate(at, 'submittedAt');

    this._status = 'IN_PREPARATION';
    this._submittedAt = new Date(at.getTime());
  }

  public complete(at: Date): void {
    if (this._status !== 'IN_PREPARATION') {
      throw new InvalidOrderError('Only orders in preparation can be completed.');
    }

    Order.validateDate(at, 'completedAt');

    this._status = 'COMPLETED';
    this._completedAt = new Date(at.getTime());
  }

  public cancel(at: Date): void {
    if (this._status !== 'DRAFT' && this._status !== 'IN_PREPARATION') {
      throw new InvalidOrderError(
        'Only draft orders or orders in preparation can be cancelled.',
      );
    }

    Order.validateDate(at, 'cancelledAt');

    this._status = 'CANCELLED';
    this._cancelledAt = new Date(at.getTime());
  }

  private ensureDraft(): void {
    if (this._status !== 'DRAFT') {
      throw new InvalidOrderError('Only draft orders can have their items modified.');
    }
  }

  private findItem(itemId: string): OrderItem {
    const item = this._items.find((currentItem) => currentItem.id === itemId);

    if (!item) {
      throw new InvalidOrderError('Order item not found.');
    }

    return item;
  }

  private static cloneItem(item: OrderItem): OrderItem {
    return new OrderItem({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      notes: item.notes,
    });
  }

  private static cloneAndValidateItems(
    orderId: string,
    items: readonly OrderItem[],
  ): OrderItem[] {
    const itemIds = new Set<string>();

    return items.map((item) => {
      if (item.orderId !== orderId) {
        throw new InvalidOrderError('Order item does not belong to this order.');
      }

      if (itemIds.has(item.id)) {
        throw new InvalidOrderError('Order item ID already exists.');
      }

      itemIds.add(item.id);

      return Order.cloneItem(item);
    });
  }

  private static normalizeCustomerName(customerName?: string | null): string | null {
    const normalizedName = customerName?.trim();

    return normalizedName || null;
  }

  private static validateBaseData(data: {
    id: string;
    tableNumber: number;
    customerName?: string | null;
    createdByUserId: string;
    createdAt?: Date;
  }): void {
    if (data.id.length === 0 || data.id !== data.id.trim()) {
      throw new InvalidOrderError('ID is invalid.');
    }

    if (!Number.isSafeInteger(data.tableNumber) || data.tableNumber <= 0) {
      throw new InvalidOrderError('Table number must be a positive integer.');
    }

    if (
      data.createdByUserId.length === 0 ||
      data.createdByUserId !== data.createdByUserId.trim()
    ) {
      throw new InvalidOrderError('User ID is invalid.');
    }

    if (data.createdAt) {
      Order.validateDate(data.createdAt, 'createdAt');
    }
  }

  private static validateStatus(status: OrderStatus): void {
    if (
      status !== 'DRAFT' &&
      status !== 'IN_PREPARATION' &&
      status !== 'COMPLETED' &&
      status !== 'CANCELLED'
    ) {
      throw new InvalidOrderError('Order status is invalid.');
    }
  }

  private static validateDate(date: Date, fieldName: string): void {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
      throw new InvalidOrderError(`${fieldName} must be a valid date.`);
    }
  }

  private static validateOptionalDate(date: Date | null, fieldName: string): void {
    if (date === null) {
      return;
    }

    Order.validateDate(date, fieldName);
  }

  private static validateLifecycle(data: {
    status: OrderStatus;
    submittedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
  }): void {
    if (data.status === 'DRAFT') {
      if (
        data.submittedAt !== null ||
        data.completedAt !== null ||
        data.cancelledAt !== null
      ) {
        throw new InvalidOrderError(
          'Draft orders cannot have lifecycle completion timestamps.',
        );
      }

      return;
    }

    if (data.status === 'IN_PREPARATION') {
      if (
        data.submittedAt === null ||
        data.completedAt !== null ||
        data.cancelledAt !== null
      ) {
        throw new InvalidOrderError(
          'Order lifecycle is inconsistent with IN_PREPARATION status.',
        );
      }

      return;
    }

    if (data.status === 'COMPLETED') {
      if (
        data.submittedAt === null ||
        data.completedAt === null ||
        data.cancelledAt !== null
      ) {
        throw new InvalidOrderError(
          'Order lifecycle is inconsistent with COMPLETED status.',
        );
      }

      return;
    }

    if (data.cancelledAt === null) {
      throw new InvalidOrderError('Cancelled orders must have cancelledAt.');
    }

    if (data.completedAt !== null) {
      throw new InvalidOrderError('Cancelled orders cannot have completedAt.');
    }
  }
}

export { Order };
