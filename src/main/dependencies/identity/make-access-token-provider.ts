import { env } from '@/infrastructure/config/env';
import { JwtAccessTokenProvider } from '@/infrastructure/authentication/jwt-access-token-provider';

export function makeAccessTokenProvider(): JwtAccessTokenProvider {
  return new JwtAccessTokenProvider({
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    secret: env.JWT_ACCESS_SECRET,
    ttlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}
