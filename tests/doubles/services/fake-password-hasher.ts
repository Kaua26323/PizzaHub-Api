import type { PasswordHasher } from '@/application/services/password-hasher';

class FakePasswordHasher implements PasswordHasher {
  public readonly hashedPasswords: string[] = [];
  public readonly comparisons: Array<{ password: string; hash: string }> = [];

  async hash(password: string): Promise<string> {
    this.hashedPasswords.push(password);

    return `hashed:${password}`;
  }

  async compare(password: string, hash: string): Promise<boolean> {
    this.comparisons.push({ password, hash });

    return `hashed:${password}` === hash;
  }
}

export { FakePasswordHasher };
