import { User } from '@/domain/entities/user';
import { Email } from '@/domain/value-objects/email';
import { ConflictError } from '@/application/errors/conflict-error';
import { ValidationError } from '@/application/errors/validation-error';

import type { UsersRepository } from '@/application/repositories/users-repository';

import type { UserRole } from '@/domain/enums/user-role';
import type { Clock } from '@/application/services/clock';
import type { IdGenerator } from '@/application/services/id-generator';
import type { PasswordHasher } from '@/application/services/password-hasher';

export type RegisterUserDTO = {
  name: string;
  email: string;
  password: string;
};

export type RegisterUserResult = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

class RegisterUserUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,

    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(data: RegisterUserDTO): Promise<RegisterUserResult> {
    if (data.password.trim().length === 0) {
      throw new ValidationError('Password is required.');
    }

    const email = new Email(data.email);

    const existingUser = await this.usersRepository.findByEmail(email.value);

    if (existingUser) throw new ConflictError('Email already exists.');

    const passwordHash = await this.passwordHasher.hash(data.password);
    const now = this.clock.now();

    const newUser = new User({
      id: this.idGenerator.generate(),
      name: data.name,
      email: email.value,
      role: 'STAFF',
      passwordHash: passwordHash,

      createdAt: now,
      updatedAt: now,
    });

    await this.usersRepository.create(newUser);

    return {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };
  }
}

export { RegisterUserUseCase };
