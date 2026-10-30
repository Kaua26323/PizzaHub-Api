import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { adminActor, controllerTestServer } from './controller-test-server';
import { ListUsersController } from '@/presentation/http/controllers/identity/list-users-controller';

import type { ListUsersUseCase } from '@/application/use-cases/identity/list-users';

const user = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Ana Silva',
  email: 'ana@example.com',
  role: 'STAFF' as const,
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  updatedAt: new Date('2026-01-03T03:04:05.000Z'),
};

function makeServer(authenticated = true) {
  const execute = vi.fn(async () => [user]);
  const controller = new ListUsersController({ execute } as unknown as ListUsersUseCase);

  return {
    execute,
    server: controllerTestServer(
      'get',
      '/users',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

describe('ListUsersController', () => {
  it('should return a public user collection directly in data', async () => {
    const { server, execute } = makeServer();

    const response = await request(server).get('/users').expect(200);

    expect(execute).toHaveBeenCalledExactlyOnceWith(adminActor);

    expect(response.body).toEqual({
      success: true,
      data: [
        {
          ...user,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      ],
      error: null,
    });

    expect(response.text).not.toContain('passwordHash');
    expect(response.text).not.toContain('refreshToken');
  });

  it('should return an empty array when no users exist', async () => {
    const { server, execute } = makeServer();
    execute.mockResolvedValueOnce([]);

    const response = await request(server).get('/users').expect(200);

    expect(response.body).toEqual({
      success: true,
      data: [],
      error: null,
    });
  });

  it('should reject requests without an authenticated actor', async () => {
    const { server, execute } = makeServer(false);

    const response = await request(server).get('/users').expect(401);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' },
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
