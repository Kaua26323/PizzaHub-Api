import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { env } from '@/infrastructure/config/env';
import { createApplicationServer } from '@/main/server';

const validCookie = `pizzahub_refresh=${'a'.repeat(43)}`;
const untrustedOrigin = 'https://untrusted.example';

describe('CSRF', () => {
  it.each(['/auth/refresh', '/auth/logout'])(
    'should reject untrusted origins for POST %s',
    async (path) => {
      const server = createApplicationServer();

      const response = await request(server)
        .post(path)
        .set('Origin', untrustedOrigin)
        .set('Cookie', validCookie)
        .set('X-CSRF-Protection', '1')
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    },
  );

  it.each([undefined, '0', 'invalid'])(
    'should reject missing or invalid CSRF headers',
    async (header) => {
      const server = createApplicationServer();

      const httpRequest = request(server)
        .post('/auth/refresh')
        .set('Origin', env.WEB_ORIGIN)
        .set('Cookie', validCookie);

      if (header !== undefined) {
        httpRequest.set('X-CSRF-Protection', header);
      }

      const response = await httpRequest.expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    },
  );

  it('should allow a valid CSRF header and allowed origin to reach the controller', async () => {
    const server = createApplicationServer();

    const response = await request(server)
      .post('/auth/refresh')
      .set('Origin', env.WEB_ORIGIN)
      .set('Cookie', validCookie)
      .set('X-CSRF-Protection', '1')
      .expect(401);

    // CSRF validation passed. Authentication failed because
    // the refresh token does not belong to a valid session.
    expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});
