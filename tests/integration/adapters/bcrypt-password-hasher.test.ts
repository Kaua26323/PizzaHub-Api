import bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';
import { BcryptPasswordHasher } from '@/infrastructure/cryptography/bcrypt-password-hasher';

describe('BcryptPasswordHasher', () => {
  const password = 'secure-password';
  const workFactor = 4;

  const passwordHasher = new BcryptPasswordHasher(workFactor);

  it('should hash a password', async () => {
    const hash = await passwordHasher.hash(password);

    expect(hash).not.toBe(password);
  });

  it('should use the configured work factor', async () => {
    const hash = await passwordHasher.hash(password);

    expect(bcrypt.getRounds(hash)).toBe(workFactor);
  });

  it('should return true when the password matches the hash', async () => {
    const hash = await passwordHasher.hash(password);

    await expect(passwordHasher.compare(password, hash)).resolves.toBe(true);
  });

  it('should return false when the password does not match the hash', async () => {
    const hash = await passwordHasher.hash(password);

    await expect(passwordHasher.compare('wrong-password', hash)).resolves.toBe(false);
  });

  it('should generate different hashes for the same password', async () => {
    const firstHash = await passwordHasher.hash(password);
    const secondHash = await passwordHasher.hash(password);

    expect(firstHash).not.toBe(secondHash);
  });
});
