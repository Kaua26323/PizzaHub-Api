import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { controllerTestServer } from './controller-test-server';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { AuthenticateUserController } from '@/presentation/http/controllers/identity/authenticate-user-controller';

import type { AuthenticateUserUseCase } from '@/application/use-cases/identity/authenticate-user';

const refreshToken = 'a'.repeat(43);
const validBody = { email: '  ANA@EXAMPLE.COM ', password: 'Secret123!' };

function makeServer(production = false) {
  const execute = vi.fn(async () => ({ accessToken: 'access-token', refreshToken }));
  const controller = new AuthenticateUserController(
    production,
    1234,
    7200,
    { execute } as unknown as AuthenticateUserUseCase,
    { maxBytes: 1024, allowEmpty: false },
  );

  return {
    execute,
    server: controllerTestServer('post', '/sessions', controller.handler),
  };
}

describe('AuthenticateUserController', () => {
  it.each([
    [true, '__Host-pizzahub_refresh', true],
    [false, 'pizzahub_refresh', false],
  ] as const)(
    'should authenticate and configure the cookie for production=%s',
    async (production, cookieName, secure) => {
      const { server, execute } = makeServer(production);

      const response = await request(server)
        .post('/sessions')
        .send(validBody)
        .expect(200);

      expect(execute).toHaveBeenCalledExactlyOnceWith({
        email: 'ana@example.com',
        password: 'Secret123!',
      });

      expect(response.body).toEqual({
        success: true,
        data: {
          accessToken: 'access-token',
          tokenType: 'Bearer',
          expiresIn: 1234,
        },
        error: null,
      });

      expect(response.text).not.toContain(refreshToken);

      const cookie = response.headers['set-cookie']?.[0] as string;

      expect(cookie).toContain(`${cookieName}=${refreshToken}`);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=7200');
      expect(cookie.includes('Secure')).toBe(secure);
      expect(cookie).not.toContain('Domain=');
    },
  );

  it('should reject invalid login data without calling the use case', async () => {
    const { server, execute } = makeServer();

    const response = await request(server)
      .post('/sessions')
      .send({ email: 'invalid', password: '' })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.' },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('should map invalid credentials to the documented HTTP error', async () => {
    const { server, execute } = makeServer();

    execute.mockRejectedValueOnce(
      new AuthenticationError('INVALID_CREDENTIALS', 'Email or password is incorrect.'),
    );

    const response = await request(server).post('/sessions').send(validBody).expect(401);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' },
    });

    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
