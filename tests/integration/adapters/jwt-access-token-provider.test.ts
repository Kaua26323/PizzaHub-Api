import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';

import type { AccessTokenClaims } from '@/application/services/access-token-provider';
import { JwtAccessTokenProvider } from '@/infrastructure/authentication/jwt-access-token-provider';
import type { JwtAccessTokenProviderConfig } from '@/infrastructure/authentication/jwt-access-token-provider';

const claims: AccessTokenClaims = {
  userId: '00000000-0000-4000-8000-000000000001',
  role: 'STAFF',
};

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

function makeSut(overrides?: Partial<JwtAccessTokenProviderConfig>) {
  const config: JwtAccessTokenProviderConfig = {
    secret: 'test-secret-that-is-long-enough-for-jwt-tests',
    issuer: 'pizzahub-api-test',
    audience: 'pizzahub-clients-test',
    ttlSeconds: 900,
    ...overrides,
  };

  const sut = new JwtAccessTokenProvider(config);

  return {
    sut,
    config,
  };
}

describe('JwtAccessTokenProvider', () => {
  it('should issue an access token with the expected claims', async () => {
    const { sut, config } = makeSut();

    const token = await sut.issue(claims);

    const { payload, protectedHeader } = await jwtVerify(
      token,
      encodeSecret(config.secret),
      {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ['HS256'],
        typ: 'JWT',
      },
    );

    expect(protectedHeader).toMatchObject({
      alg: 'HS256',
      typ: 'JWT',
    });

    expect(payload.sub).toBe(claims.userId);
    expect(payload.role).toBe(claims.role);

    expect(payload.iss).toBe(config.issuer);
    expect(payload.aud).toBe(config.audience);

    expect(payload.iat).toEqual(expect.any(Number));
    expect(payload.exp).toEqual(expect.any(Number));
    expect(payload.jti).toEqual(expect.any(String));
  });

  it('should issue an access token using the configured lifetime', async () => {
    const { sut, config } = makeSut();

    const token = await sut.issue(claims);

    const { payload } = await jwtVerify(token, encodeSecret(config.secret), {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['HS256'],
      typ: 'JWT',
    });

    expect(payload.iat).toEqual(expect.any(Number));
    expect(payload.exp).toEqual(expect.any(Number));

    expect(payload.exp! - payload.iat!).toBe(config.ttlSeconds);
  });

  it('should issue a unique jti for each access token', async () => {
    const { sut, config } = makeSut();

    const firstToken = await sut.issue(claims);
    const secondToken = await sut.issue(claims);

    const first = await jwtVerify(firstToken, encodeSecret(config.secret), {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['HS256'],
      typ: 'JWT',
    });

    const second = await jwtVerify(secondToken, encodeSecret(config.secret), {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['HS256'],
      typ: 'JWT',
    });

    expect(first.payload.jti).not.toBe(second.payload.jti);
  });

  it('should verify a valid access token', async () => {
    const { sut } = makeSut();

    const token = await sut.issue(claims);

    await expect(sut.verify(token)).resolves.toEqual(claims);
  });

  it('should reject an access token signed with another secret', async () => {
    const { sut } = makeSut();

    const { sut: anotherProvider } = makeSut({
      secret: 'another-test-secret-that-is-long-enough',
    });

    const token = await anotherProvider.issue(claims);

    await expect(sut.verify(token)).rejects.toThrow();
  });

  it('should reject an access token with another issuer', async () => {
    const { sut } = makeSut();

    const { sut: anotherProvider } = makeSut({
      issuer: 'another-api',
    });

    const token = await anotherProvider.issue(claims);

    await expect(sut.verify(token)).rejects.toThrow();
  });

  it('should reject an access token with another audience', async () => {
    const { sut } = makeSut();

    const { sut: anotherProvider } = makeSut({
      audience: 'another-client',
    });

    const token = await anotherProvider.issue(claims);

    await expect(sut.verify(token)).rejects.toThrow();
  });

  it('should reject an expired access token', async () => {
    const { sut, config } = makeSut();

    const now = Math.floor(Date.now() / 1000);

    const token = await new SignJWT({
      role: claims.role,
    })
      .setProtectedHeader({
        alg: 'HS256',
        typ: 'JWT',
      })
      .setSubject(claims.userId)
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setIssuedAt(now - 1000)
      .setExpirationTime(now - 1)
      .setJti(randomUUID())
      .sign(encodeSecret(config.secret));

    await expect(sut.verify(token)).rejects.toThrow();
  });

  it('should reject an access token using another algorithm', async () => {
    const { sut, config } = makeSut();

    const token = await new SignJWT({
      role: claims.role,
    })
      .setProtectedHeader({
        alg: 'HS384',
        typ: 'JWT',
      })
      .setSubject(claims.userId)
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setIssuedAt()
      .setExpirationTime('15m')
      .setJti(randomUUID())
      .sign(encodeSecret(config.secret));

    await expect(sut.verify(token)).rejects.toThrow();
  });

  it('should reject an access token with an invalid role', async () => {
    const { sut, config } = makeSut();

    const token = await new SignJWT({
      role: 'OWNER',
    })
      .setProtectedHeader({
        alg: 'HS256',
        typ: 'JWT',
      })
      .setSubject(claims.userId)
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setIssuedAt()
      .setExpirationTime('15m')
      .setJti(randomUUID())
      .sign(encodeSecret(config.secret));

    await expect(sut.verify(token)).rejects.toThrow('Invalid access token claims.');
  });

  it('should reject an access token without required claims', async () => {
    const { sut, config } = makeSut();

    const token = await new SignJWT({
      role: claims.role,
    })
      .setProtectedHeader({
        alg: 'HS256',
        typ: 'JWT',
      })
      .setSubject(claims.userId)
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setIssuedAt()
      .setExpirationTime('15m')
      // intentionally missing jti
      .sign(encodeSecret(config.secret));

    await expect(sut.verify(token)).rejects.toThrow();
  });
});
