import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { adminActor, controllerTestServer } from './controller-test-server';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { LogoutAllOwnSessionController } from '@/presentation/http/controllers/identity/logout-all-own-sessions-controller';

import type { LogoutAllOwnSessionsUseCase } from '@/application/use-cases/identity/logout-all-own-sessions';

function makeServer(authenticated = true) {
  const execute = vi.fn(async () => undefined);
  const controller = new LogoutAllOwnSessionController(false, {
    execute,
  } as unknown as LogoutAllOwnSessionsUseCase);

  return {
    execute,
    server: controllerTestServer(
      'post',
      '/sessions/logout-all',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

describe('LogoutAllOwnSessionController', () => {
  it('should revoke the authenticated actors sessions and clear the cookie with empty HTTP 204', async () => {
    const { server, execute } = makeServer();

    const response = await request(server).post('/sessions/logout-all').expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith(adminActor);
    expect(response.text).toBe('');
    expect(response.headers['set-cookie']?.[0]).toContain('pizzahub_refresh=');
    expect(response.headers['set-cookie']?.[0]).toContain('Max-Age=0');
  });

  it('should reject requests without an authenticated actor', async () => {
    const { server, execute } = makeServer(false);

    const response = await request(server).post('/sessions/logout-all').expect(401);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('should leave the cookie unchanged when the use case fails', async () => {
    const { server, execute } = makeServer();
    execute.mockRejectedValueOnce(new AuthorizationError('FORBIDDEN'));

    const response = await request(server).post('/sessions/logout-all').expect(403);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      },
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
