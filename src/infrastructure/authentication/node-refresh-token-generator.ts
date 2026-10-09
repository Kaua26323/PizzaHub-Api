import { randomBytes } from 'node:crypto';
import type { RefreshTokenGenerator } from '@/application/services/refresh-token-generator';

class NodeRefreshTokenGenerator implements RefreshTokenGenerator {
  async generate(): Promise<string> {
    return randomBytes(32).toString('base64url');
  }
}

export { NodeRefreshTokenGenerator };
