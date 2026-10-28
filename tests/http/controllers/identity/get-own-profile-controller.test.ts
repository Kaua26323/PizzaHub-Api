import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { adminActor, controllerTestServer } from './controller-test-server';
import { GetOwnProfileController } from '@/presentation/http/controllers/identity/get-own-profile-controller';

import type { GetOwnProfileUseCase } from '@/application/use-cases/identity/get-own-profile';

const createdAt = new Date('2026-01-02T03:04:05.000Z');
const updatedAt = new Date('2026-01-03T03:04:05.000Z');

function makeServer(authenticated = true) {
  const execute = vi.fn(async () => ({
    id: adminActor.id,
    name: 'Ana Silva',
    email: 'ana@example.com',
    role: 'ADMIN' as const,
    createdAt,
    updatedAt,
    passwordHash: 'private-hash',
    internalSessionId: 'private-session',
  }));
  const controller = new GetOwnProfileController({
    execute,
  } as unknown as GetOwnProfileUseCase);

  return {
    execute,
    server: controllerTestServer(
      'get',
      '/users/me',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

describe('GetOwnProfileController', () => {
  it('should return the authenticated actors public profile with ISO dates', async () => {
    const { server, execute } = makeServer();

    const response = await request(server).get('/users/me').expect(200);

    expect(execute).toHaveBeenCalledExactlyOnceWith(adminActor);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: adminActor.id,
        name: 'Ana Silva',
        email: 'ana@example.com',
        role: 'ADMIN',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
      error: null,
    });
    expect(response.text).not.toContain('private-hash');
    expect(response.text).not.toContain('private-session');
  });

  it('should reject requests without an authenticated actor', async () => {
    const { server, execute } = makeServer(false);

    const response = await request(server).get('/users/me').expect(401);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' },
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
