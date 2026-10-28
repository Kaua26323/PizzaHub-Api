import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { controllerTestServer } from './controller-test-server';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { LogoutCurrentSessionController } from '@/presentation/http/controllers/identity/logout-current-session-controller';

import type { LogoutCurrentSessionUseCase } from '@/application/use-cases/identity/logout-current-session';

const refreshToken = 'a'.repeat(43);

function makeServer() {
  const execute = vi.fn(async () => undefined);
  const controller = new LogoutCurrentSessionController(false, {
    execute,
  } as unknown as LogoutCurrentSessionUseCase);

  return {
    execute,
    server: controllerTestServer('post', '/sessions/logout', controller.handler),
  };
}

describe('LogoutCurrentSessionController', () => {
  it('should revoke the cookie session and return empty HTTP 204 with a cleared cookie', async () => {
    const { server, execute } = makeServer();

    const response = await request(server)
      .post('/sessions/logout')
      .set('Cookie', `pizzahub_refresh=${refreshToken}`)
      .set('X-CSRF-Protection', '1')
      .expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith(refreshToken);

    expect(response.text).toBe('');
    expect(response.headers['set-cookie']?.[0]).toContain('pizzahub_refresh=');
    expect(response.headers['set-cookie']?.[0]).toContain('Max-Age=0');
  });

  it.each([
    [undefined, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token.', 401],
    ['bad', 'INVALID_REFRESH_TOKEN', 'Invalid refresh token.', 401],
    [
      refreshToken,
      'FORBIDDEN',
      'You do not have permission to perform this action.',
      403,
    ],
  ] as const)(
    'should require a valid refresh cookie and CSRF header',
    async (cookie, code, message, status) => {
      const { server, execute } = makeServer();
      const call = request(server).post('/sessions/logout');

      if (cookie !== undefined) {
        call.set('Cookie', `pizzahub_refresh=${cookie}`);
      }

      if (cookie !== refreshToken) {
        call.set('X-CSRF-Protection', '1');
      }

      const response = await call.expect(status);

      expect(response.body).toEqual({
        success: false,
        data: null,
        error: { code, message },
      });

      expect(execute).not.toHaveBeenCalled();
      expect(response.headers['set-cookie']).toBeUndefined();
    },
  );

  it('should preserve the cookie when revocation fails', async () => {
    const { server, execute } = makeServer();
    execute.mockRejectedValueOnce(
      new AuthenticationError('INVALID_REFRESH_TOKEN', 'Invalid refresh token.'),
    );

    const response = await request(server)
      .post('/sessions/logout')
      .set('Cookie', `pizzahub_refresh=${refreshToken}`)
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
