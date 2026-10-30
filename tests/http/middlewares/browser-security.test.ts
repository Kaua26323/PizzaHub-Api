import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { env } from '@/infrastructure/config/env';
import { createApplicationServer } from '@/main/server';
import { createClearRefreshTokenCookie } from '@/presentation/http/validation/identity/refresh-token-transport';

const validCookie = `pizzahub_refresh=${'a'.repeat(43)}`;
const untrustedOrigin = 'https://untrusted.example';

describe('Identity browser security', () => {
  describe('CORS', () => {
    it('should allow preflight requests from the configured browser origin', async () => {
      const server = createApplicationServer();

      const response = await request(server)
        .options('/auth/refresh')
        .set('Origin', env.WEB_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'X-CSRF-Protection, Content-Type')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe(env.WEB_ORIGIN);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain('POST');

      expect(response.headers['access-control-allow-headers']?.toLowerCase()).toContain(
        'x-csrf-protection',
      );

      expect(response.headers['access-control-allow-origin']).not.toBe('*');
    });

    it('should reject preflight requests from untrusted origins', async () => {
      const server = createApplicationServer();

      const response = await request(server)
        .options('/auth/refresh')
        .set('Origin', untrustedOrigin)
        .set('Access-Control-Request-Method', 'POST')
        .expect(403);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('should reject preflight requests with unsupported methods', async () => {
      const server = createApplicationServer();

      await request(server)
        .options('/auth/refresh')
        .set('Origin', env.WEB_ORIGIN)
        .set('Access-Control-Request-Method', 'TRACE')
        .expect(403);
    });

    it('should reject preflight requests with unsupported headers', async () => {
      const server = createApplicationServer();

      await request(server)
        .options('/auth/refresh')
        .set('Origin', env.WEB_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'X-Unauthorized-Header')
        .expect(403);
    });

    it('should include CORS headers on requests from the allowed origin', async () => {
      const server = createApplicationServer();

      const response = await request(server)
        .post('/auth/refresh')
        .set('Origin', env.WEB_ORIGIN)
        .set('Cookie', validCookie)
        .set('X-CSRF-Protection', '1')
        .expect(401);

      expect(response.headers['access-control-allow-origin']).toBe(env.WEB_ORIGIN);

      expect(response.headers['access-control-allow-credentials']).toBe('true');

      // The request passed the CSRF middleware, but the token
      // does not correspond to a valid authentication session.
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('Cookie security', () => {
    it('should clear the production cookie using the documented security attributes', () => {
      const cookie = createClearRefreshTokenCookie(true);

      expect(cookie).toContain('__Host-pizzahub_refresh=;');
      expect(cookie).toContain('Max-Age=0');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/');
      expect(cookie).not.toContain('Domain=');
    });
  });
});
