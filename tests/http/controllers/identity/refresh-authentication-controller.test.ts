import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { controllerTestServer } from './controller-test-server';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { RefreshAuthenticationController } from '@/presentation/http/controllers/identity/refresh-authentication-controller';

import type { RefreshAuthenticationUseCase } from '@/application/use-cases/identity/refresh-authentication';

const originalToken = 'a'.repeat(43);
const rotatedToken = 'b'.repeat(43);
const now = new Date('2026-01-02T03:04:05.000Z');

function makeServer() {
  const execute = vi.fn(async () => ({
    accessToken: 'new-access-token',
    refreshToken: rotatedToken,
    expiresAt: new Date(now.getTime() + 3600_000),
  }));

  const controller = new RefreshAuthenticationController(false, 1234, {
    execute,
  } as unknown as RefreshAuthenticationUseCase);

  return {
    execute,
    server: controllerTestServer('post', '/sessions/refresh', controller.handler),
  };
}

afterEach(() => vi.useRealTimers());

describe('RefreshAuthenticationController', () => {
  it('should rotate the cookie token and set Max-Age to the remaining absolute session lifetime', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    const { server, execute } = makeServer();

    const response = await request(server)
      .post('/sessions/refresh')
      .set('Cookie', `pizzahub_refresh=${originalToken}`)
      .set('X-CSRF-Protection', '1')
      .expect(200);

    expect(execute).toHaveBeenCalledExactlyOnceWith(originalToken);
    expect(response.body).toEqual({
      success: true,
      data: {
        accessToken: 'new-access-token',
        tokenType: 'Bearer',
        expiresIn: 1234,
      },
      error: null,
    });

    expect(response.text).not.toContain(rotatedToken);

    const cookie = response.headers['set-cookie']?.[0] as string;

    expect(cookie).toContain(`pizzahub_refresh=${rotatedToken}`);
    expect(cookie).toContain('Max-Age=3600');
    expect(cookie).not.toContain('Max-Age=604800');
  });

  it.each([
    [undefined, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token.', 401],
    ['invalid', 'INVALID_REFRESH_TOKEN', 'Invalid refresh token.', 401],
    [
      originalToken,
      'FORBIDDEN',
      'You do not have permission to perform this action.',
      403,
    ],
  ] as const)(
    'should reject a missing or invalid cookie or missing CSRF header',
    async (cookie, code, message, status) => {
      const { server, execute } = makeServer();
      const call = request(server).post('/sessions/refresh');

      if (cookie !== undefined) {
        call.set('Cookie', `pizzahub_refresh=${cookie}`);
      }

      if (cookie !== originalToken) {
        call.set('X-CSRF-Protection', '1');
      }

      const response = await call.expect(status);

      expect(response.body).toEqual({
        success: false,
        data: null,
        error: { code, message },
      });

      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('should propagate revoked refresh-token errors without setting a cookie', async () => {
    const { server, execute } = makeServer();
    execute.mockRejectedValueOnce(
      new AuthenticationError('INVALID_REFRESH_TOKEN', 'Invalid refresh token.'),
    );

    const response = await request(server)
      .post('/sessions/refresh')
      .set('Cookie', `pizzahub_refresh=${originalToken}`)
      .set('X-CSRF-Protection', '1')
      .expect(401);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token.' },
    });

    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
