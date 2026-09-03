import { AuthorizationError } from '@/application/errors/authorization-error';

import type { UserRole } from '@/domain/enums/user-role';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { UsersRepository } from '@/application/repositories/users-repository';

export type ListedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

export type ListUsersResult = ListedUser[];

class ListUsersUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(actor: AuthenticatedActor): Promise<ListUsersResult> {
    if (actor.role !== 'ADMIN') throw new AuthorizationError();

    const users = await this.usersRepository.listUsers();

    return users.map((user) => {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    });
  }
}

export { ListUsersUseCase };
