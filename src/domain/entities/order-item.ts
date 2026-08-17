import { InvalidOrderItemError } from '../errors/invalid-order-item-error';
import { Money } from '../value-objects/money';
import { Quantity } from '../value-objects/quantity';

export interface OrderItemProps {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  unitPrice: string;
  quantity: number;
  notes?: string | null;
}

class OrderItem {
  private readonly _id: string;
  private readonly _orderId: string;
  private readonly _productId: string;
  private readonly _productName: string;
  private readonly _unitPrice: Money;
  private _quantity: Quantity;
  private _notes: string | null;

  constructor(data: OrderItemProps) {
    OrderItem.validate(data);
    this._id = data.id;
    this._orderId = data.orderId;
    this._productId = data.productId;
    this._productName = data.productName.trim();
    this._unitPrice = new Money(data.unitPrice);
    this._quantity = new Quantity(data.quantity);
    this._notes = OrderItem.normalizeNotes(data.notes);
  }

  get id(): string {
    return this._id;
  }

  get orderId(): string {
    return this._orderId;
  }

  get productId(): string {
    return this._productId;
  }

  get productName(): string {
    return this._productName;
  }
  get unitPrice(): string {
    return this._unitPrice.value;
  }
  get quantity(): number {
    return this._quantity.value;
  }

  get subtotal(): string {
    const price = this._unitPrice.multiply(this._quantity.value);

    return price.value;
  }

  get notes(): string | null {
    return this._notes;
  }

  public changeQuantity(newQuantity: number): void {
    this._quantity = new Quantity(newQuantity);
  }

  public changeNotes(newNotes: string | null): void {
    OrderItem.validateNotes(newNotes);
    this._notes = OrderItem.normalizeNotes(newNotes);
  }

  private static normalizeNotes(notes?: string | null): string | null {
    const normalizedNotes = notes?.trim();

    return normalizedNotes || null;
  }

  private static validateNotes(notes?: string | null): void {
    if (notes == null) return;

    if (notes.trim().length > 500) {
      throw new InvalidOrderItemError('Notes must not exceed 500 characters.');
    }
  }

  private static validate(data: OrderItemProps): void {
    if (data.id.length === 0 || data.id !== data.id.trim()) {
      throw new InvalidOrderItemError('ID is invalid.');
    }
    if (data.orderId.length === 0 || data.orderId !== data.orderId.trim()) {
      throw new InvalidOrderItemError('orderId is invalid.');
    }
    if (data.productId.length === 0 || data.productId !== data.productId.trim()) {
      throw new InvalidOrderItemError('productId is invalid.');
    }
    if (data.productName.trim().length === 0) {
      throw new InvalidOrderItemError('Product name is invalid.');
    }

    OrderItem.validateNotes(data.notes);
  }
}

export { OrderItem };
