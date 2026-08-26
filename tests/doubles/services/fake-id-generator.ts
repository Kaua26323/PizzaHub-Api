import type { IdGenerator } from '@/application/services/id-generator';

class FakeIdGenerator implements IdGenerator {
  public readonly generatedIds: string[] = [];
  private readonly queuedIds: string[];
  private nextIdNumber = 1;

  constructor(queuedIds: readonly string[] = []) {
    this.queuedIds = [...queuedIds];
  }

  generate(): string {
    const id = this.queuedIds.shift() ?? `id-${this.nextIdNumber++}`;

    this.generatedIds.push(id);

    return id;
  }
}

export { FakeIdGenerator };
