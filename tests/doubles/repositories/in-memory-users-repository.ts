import type {
  UpdateUserRoleParams,
  UsersRepository,
} from '@/application/repositories/users-repository';
import { User } from '@/domain/entities/user';

function cloneUser(user: User): User {
  return new User({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
}

class InMemoryUsersRepository implements UsersRepository {
  public readonly users: User[] = [];

  async create(data: User): Promise<void> {
    this.users.push(cloneUser(data));
  }

  async listUsers(): Promise<User[]> {
    return this.users.map(cloneUser);
  }

  async findById(userId: string): Promise<User | null> {
    const user = this.users.find((item) => item.id === userId);

    return user ? cloneUser(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.users.find((item) => item.email === normalizedEmail);

    return user ? cloneUser(user) : null;
  }

  async updateRole(params: UpdateUserRoleParams): Promise<void> {
    const user = this.users.find((item) => item.id === params.userId);

    user?.changeRole(params.role);
  }
}

export { InMemoryUsersRepository };
