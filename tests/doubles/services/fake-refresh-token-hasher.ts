import type { RefreshTokenHasher } from '@/application/services/refresh-token-hasher';

class FakeRefreshTokenHasher implements RefreshTokenHasher {
  public readonly hashedTokens: string[] = [];

  async hash(token: string): Promise<string> {
    this.hashedTokens.push(token);

    return `hashed:${token}`;
  }
}

export { FakeRefreshTokenHasher };
