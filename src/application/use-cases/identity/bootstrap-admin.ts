import { User } from '@/domain/entities/user';
import { Email } from '@/domain/value-objects/email';

import { ConflictError } from '@/application/errors/conflict-error';
import { ValidationError } from '@/application/errors/validation-error';

import type { Clock } from '@/application/services/clock';
import type { IdGenerator } from '@/application/services/id-generator';
import type { PasswordHasher } from '@/application/services/password-hasher';

import type { UsersRepository } from '@/application/repositories/users-repository';

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
      throw new ValidationError('VALIDATION_ERROR', 'Password is required.');
    }

    const email = new Email(data.email);

    const existingUser = await this.usersRepository.findByEmail(email.value);

    if (existingUser) {
      throw new ConflictError('EMAIL_ALREADY_EXISTS', 'Email already exists.');
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

    const result = await this.usersRepository.createInitialAdmin(admin);

    if (result.status === 'admin-already-exists') {
      throw new ConflictError('ADMIN_ALREADY_EXISTS', 'An administrator already exists.');
    }
  }
}

export { BootstrapAdminUseCase };
