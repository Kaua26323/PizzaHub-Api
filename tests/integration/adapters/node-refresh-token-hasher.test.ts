import { describe, expect, it } from 'vitest';
import { NodeRefreshTokenHasher } from '@/infrastructure/authentication/node-refresh-token-hasher';

describe('NodeRefreshTokenHasher', () => {
  it('should generate a SHA-256 hash', async () => {
    const sut = new NodeRefreshTokenHasher();

    const hash = await sut.hash('refresh-token');

    expect(hash).toBe('0eb17643d4e9261163783a420859c92c7d212fa9624106a12b510afbec266120');
  });

  it('should generate the same hash for the same token', async () => {
    const sut = new NodeRefreshTokenHasher();

    const firstHash = await sut.hash('refresh-token');
    const secondHash = await sut.hash('refresh-token');

    expect(firstHash).toBe(secondHash);
  });

  it('should generate different hashes for different tokens', async () => {
    const sut = new NodeRefreshTokenHasher();

    const firstHash = await sut.hash('refresh-token-1');
    const secondHash = await sut.hash('refresh-token-2');

    expect(firstHash).not.toBe(secondHash);
  });
});
