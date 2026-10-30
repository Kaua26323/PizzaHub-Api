import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { adminActor, controllerTestServer } from './controller-test-server';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { ChangeUserRoleController } from '@/presentation/http/controllers/identity/change-user-role-controller';

import type { ChangeUserRoleUseCase } from '@/application/use-cases/identity/change-user-role';

const targetUserId = '00000000-0000-4000-8000-000000000002';

function makeServer(authenticated = true) {
  const execute = vi.fn(async () => undefined);
  const controller = new ChangeUserRoleController(
    { execute } as unknown as ChangeUserRoleUseCase,
    { maxBytes: 1024, allowEmpty: false },
  );

  return {
    execute,
    server: controllerTestServer(
      'patch',
      '/users/:userId/role',
      controller.handler,
      authenticated ? adminActor : undefined,
    ),
  };
}

describe('ChangeUserRoleController', () => {
  it('should pass the actor, route user ID, and validated role to the use case and return empty HTTP 204', async () => {
    const { server, execute } = makeServer();

    const response = await request(server)
      .patch(`/users/${targetUserId}/role`)
      .send({ role: 'ADMIN' })
      .expect(204);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actor: adminActor,
      targetUserId,
      targetRole: 'ADMIN',
    });

    expect(response.text).toBe('');
  });

  it.each([
    ['/users/not-a-uuid/role', { role: 'ADMIN' }, 'userId'],
    [`/users/${targetUserId}/role`, { role: 'OWNER' }, 'role'],
    [`/users/${targetUserId}/role`, { role: 'STAFF', userId: adminActor.id }, ''],
  ])(
    'should reject malformed IDs, unsupported roles, and unexpected body fields',
    async (path, body, detailPath) => {
      const { server, execute } = makeServer();

      const response = await request(server).patch(path).send(body).expect(400);

      expect(response.body).toMatchObject({
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
        },
      });

      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: detailPath })]),
      );

      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('should reject requests without an authenticated actor', async () => {
    const { server, execute } = makeServer(false);

    const response = await request(server)
      .patch(`/users/${targetUserId}/role`)
      .send({ role: 'STAFF' })
      .expect(401);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required.',
      },
    });

    expect(execute).not.toHaveBeenCalled();
  });

  it('should propagate application authorization errors through the HTTP envelope', async () => {
    const { server, execute } = makeServer();
    execute.mockRejectedValueOnce(new AuthorizationError('FORBIDDEN'));

    const response = await request(server)
      .patch(`/users/${targetUserId}/role`)
      .send({ role: 'STAFF' })
      .expect(403);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      },
    });
  });
});
