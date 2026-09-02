import { User } from '@/domain/entities/user';
import { Email } from '@/domain/value-objects/email';

import { ConflictError } from '@/application/errors/conflict-error';
import { ValidationError } from '@/application/errors/validation-error';

import type { UsersRepository } from '@/application/repositories/users-repository';
import type { Clock } from '@/application/services/clock';
import type { IdGenerator } from '@/application/services/id-generator';
import type { PasswordHasher } from '@/application/services/password-hasher';

export type BootstrapAdminDTO = {
  name: string;
  email: string;
  password: string;
};

class BootstrapAdminUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,

    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(data: BootstrapAdminDTO): Promise<void> {
    if (data.password.trim().length === 0) {
      throw new ValidationError('Password is required.');
    }

    const email = new Email(data.email);

    const existingUser = await this.usersRepository.findByEmail(email.value);

    if (existingUser) {
      throw new ConflictError('Email already exists.');
    }

    const passwordHash = await this.passwordHasher.hash(data.password);

    const now = this.clock.now();

    const admin = new User({
      id: this.idGenerator.generate(),
      name: data.name,
      email: email.value,
      role: 'ADMIN',
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    await this.usersRepository.create(admin);
  }
}

export { BootstrapAdminUseCase };
