import type { RefreshTokenGenerator } from '@/application/services/refresh-token-generator';

class FakeRefreshTokenGenerator implements RefreshTokenGenerator {
  public readonly generatedTokens: string[] = [];
  private readonly queuedTokens: string[];
  private nextTokenNumber = 1;

  constructor(queuedTokens: readonly string[] = []) {
    this.queuedTokens = [...queuedTokens];
  }

  async generate(): Promise<string> {
    const token = this.queuedTokens.shift() ?? `refresh-token-${this.nextTokenNumber++}`;

    this.generatedTokens.push(token);

    return token;
  }
}

export { FakeRefreshTokenGenerator };
