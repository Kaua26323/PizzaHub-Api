import { createHash } from 'node:crypto';
import type { RefreshTokenHasher } from '@/application/services/refresh-token-hasher';

class NodeRefreshTokenHasher implements RefreshTokenHasher {
  async hash(token: string): Promise<string> {
    return createHash('sha256').update(token).digest('hex');
  }
}
export { NodeRefreshTokenHasher };
