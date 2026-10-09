import bcrypt from 'bcrypt';
import type { PasswordHasher } from '@/application/services/password-hasher';

class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly workFactor: number) {}

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.workFactor);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
export { BcryptPasswordHasher };
