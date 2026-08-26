import { Email } from '../value-objects/email';
import type { UserRole } from '../enums/user-role';
import { InvalidUserError } from '../errors/invalid-user-error';

export interface UserProps {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
  passwordHash: string;
}

class User {
  private readonly _id: string;
  private _name: string;
  private _email: Email;
  private _role: UserRole;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private readonly _passwordHash: string;

  constructor(data: UserProps) {
    User.validate(data);

    this._id = data.id;
    this._name = data.name.trim();
    this._role = data.role;
    this._email = new Email(data.email);
    this._passwordHash = data.passwordHash;

    const now = new Date();
    this._createdAt = data.createdAt ? new Date(data.createdAt.getTime()) : now;
    this._updatedAt = data.updatedAt ? new Date(data.updatedAt.getTime()) : now;
  }

  get id(): string {
    return this._id;
  }
  get name(): string {
    return this._name;
  }
  get role(): UserRole {
    return this._role;
  }
  get email(): string {
    return this._email.value;
  }
  get passwordHash(): string {
    return this._passwordHash;
  }
  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }
  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  public changeName(newName: string): void {
    User.validateName(newName);

    this._name = newName.trim();
    this.touch();
  }

  public changeEmail(newEmail: string): void {
    this._email = new Email(newEmail);
    this.touch();
  }

  public changeRole(newRole: UserRole): void {
    User.validateRole(newRole);

    this._role = newRole;
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static validateName(name: string): void {
    if (name.trim().length === 0) {
      throw new InvalidUserError('User name is required.');
    }
  }

  private static validateRole(role: UserRole): void {
    if (role !== 'STAFF' && role !== 'ADMIN') {
      throw new InvalidUserError('User role must be "STAFF" or "ADMIN".');
    }
  }

  private static validate(data: UserProps): void {
    if (data.id.length === 0 || data.id !== data.id.trim()) {
      throw new InvalidUserError('User ID is invalid.');
    }

    User.validateName(data.name);
    User.validateRole(data.role);

    if (data.passwordHash.trim().length === 0) {
      throw new InvalidUserError('Password hash is required.');
    }

    if (data.createdAt && !Number.isFinite(data.createdAt.getTime())) {
      throw new InvalidUserError('createdAt must be a valid date.');
    }

    if (data.updatedAt && !Number.isFinite(data.updatedAt.getTime())) {
      throw new InvalidUserError('updatedAt must be a valid date.');
    }
  }
}

export { User };
