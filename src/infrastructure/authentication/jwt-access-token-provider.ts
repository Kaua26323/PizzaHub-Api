import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { JOSEError, JWTClaimValidationFailed, JWTExpired } from 'jose/errors';

import { AuthenticationError } from '@/application/errors/authentication-error';
import type {
  AccessTokenClaims,
  AccessTokenProvider,
} from '@/application/services/access-token-provider';

export type JwtAccessTokenProviderConfig = {
  secret: string;
  issuer: string;
  audience: string;
  ttlSeconds: number;
};

const algorithm = 'HS256';

function isAccessTokenRole(value: unknown): value is AccessTokenClaims['role'] {
  return value === 'ADMIN' || value === 'STAFF';
}

class JwtAccessTokenProvider implements AccessTokenProvider {
  private readonly secret: Uint8Array;

  constructor(private readonly config: JwtAccessTokenProviderConfig) {
    this.secret = new TextEncoder().encode(config.secret);
  }

  async issue(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({
      role: claims.role,
    })
      .setProtectedHeader({
        alg: algorithm,
        typ: 'JWT',
      })
      .setSubject(claims.userId)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.config.ttlSeconds}s`)
      .setJti(randomUUID())
      .sign(this.secret);
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        typ: 'JWT',
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [algorithm],
        requiredClaims: ['sub', 'iss', 'aud', 'iat', 'exp', 'jti'],
      });

      if (typeof payload.sub !== 'string' || !isAccessTokenRole(payload.role)) {
        throw new AuthenticationError(
          'INVALID_ACCESS_TOKEN',
          'Invalid access token claims.',
        );
      }

      return {
        userId: payload.sub,
        role: payload.role,
      };
    } catch (error: unknown) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      if (error instanceof JWTExpired) {
        throw new AuthenticationError(
          'ACCESS_TOKEN_EXPIRED',
          'Access token has expired.',
        );
      }

      if (error instanceof JWTClaimValidationFailed) {
        throw new AuthenticationError(
          'INVALID_ACCESS_TOKEN',
          'Invalid access token claims.',
        );
      }

      if (error instanceof JOSEError) {
        throw new AuthenticationError('INVALID_ACCESS_TOKEN', 'Invalid access token.');
      }

      throw error;
    }
  }
}

export { JwtAccessTokenProvider };
