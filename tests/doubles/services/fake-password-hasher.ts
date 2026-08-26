import type { PasswordHasher } from '@/application/services/password-hasher';

class InMemoryPasswordHasherService implements PasswordHasher {
  public readonly hashedPasswords: string[] = [];
  public readonly comparisons: Array<{ hash: string; password: string }> = [];

  async hash(password: string): Promise<string> {
    this.hashedPasswords.push(password);

    return `hashed:${password}`;
  }

  async compare(hash: string, password: string): Promise<boolean> {
    this.comparisons.push({ hash, password });

    return hash === `hashed:${password}`;
  }
}

export { InMemoryPasswordHasherService };
