import { AuthenticationError } from '@/application/errors/authentication-error';

import type { UserRole } from '@/domain/enums/user-role';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import type { UsersRepository } from '@/application/repositories/users-repository';

type GetOwnProfileResult = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

class GetOwnProfileUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(actor: AuthenticatedActor): Promise<GetOwnProfileResult> {
    const user = await this.usersRepository.findById(actor.id);

    if (!user) throw new AuthenticationError('Authentication failed.');

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export { GetOwnProfileUseCase };
