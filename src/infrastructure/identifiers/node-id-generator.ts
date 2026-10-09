import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '@/application/services/id-generator';

class NodeIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}

export { NodeIdGenerator };
