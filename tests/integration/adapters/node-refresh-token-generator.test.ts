import { describe, expect, it } from 'vitest';
import { NodeRefreshTokenGenerator } from '@/infrastructure/authentication/node-refresh-token-generator';

describe('NodeRefreshTokenGenerator', () => {
  it('should generate a refresh token with 32 random bytes', async () => {
    const sut = new NodeRefreshTokenGenerator();

    const token = await sut.generate();

    const decodedToken = Buffer.from(token, 'base64url');

    expect(decodedToken).toHaveLength(32);
  });

  it('should generate different refresh tokens', async () => {
    const sut = new NodeRefreshTokenGenerator();

    const firstToken = await sut.generate();
    const secondToken = await sut.generate();

    expect(firstToken).not.toBe(secondToken);
  });
});
