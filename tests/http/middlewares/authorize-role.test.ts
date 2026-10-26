import { describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { UserRole } from '@/domain/enums/user-role';
import type { AuthenticatedActor } from '@/application/authenticated-actor';
import { AuthorizationError } from '@/application/errors/authorization-error';
import { authorizeRole } from '@/presentation/http/middlewares/authorize-role';
import {
  parseRequestUrl,
  getRequestContext,
  setRequestContext,
  createRequestContext,
  setAuthenticatedActor,
} from '@/presentation/http/request/request-context';

function makeSut(allowedRoles: UserRole[], actor?: AuthenticatedActor) {
  const request = { headers: {} } as IncomingMessage;
  const response = {} as ServerResponse;
  const context = createRequestContext(parseRequestUrl('/users'), '/users');

  setRequestContext(request, context);

  if (actor) {
    setAuthenticatedActor(request, actor);
  }

  const next = vi.fn(async (): Promise<void> => {});
  const middleware = authorizeRole(allowedRoles);

  return { request, response, next, middleware };
}

describe('authorizeRole', () => {
  it('should reject requests without an authenticated actor', async () => {
    const { request, response, next, middleware } = makeSut(['ADMIN']);

    await expect(middleware(request, response, next)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication is required.',
    });

    expect(next).not.toHaveBeenCalled();
    expect(getRequestContext(request).actor).toBeUndefined();
  });

  it('should reject STAFF users from ADMIN-only routes', async () => {
    const { request, response, next, middleware } = makeSut(['ADMIN'], {
      id: 'staff-123',
      role: 'STAFF',
    });

    await expect(middleware(request, response, next)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(next).not.toHaveBeenCalled();
  });

  it('should allow ADMIN users to access ADMIN-only routes', async () => {
    const actor: AuthenticatedActor = { id: 'admin-123', role: 'ADMIN' };
    const { request, response, next, middleware } = makeSut(['ADMIN'], actor);

    await expect(middleware(request, response, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledOnce();
    expect(getRequestContext(request).actor).toEqual(actor);
  });

  it('should allow STAFF users when STAFF is an allowed role', async () => {
    const { request, response, next, middleware } = makeSut(['ADMIN', 'STAFF'], {
      id: 'staff-123',
      role: 'STAFF',
    });

    await middleware(request, response, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('should reject authenticated users when no roles are allowed', async () => {
    const { request, response, next, middleware } = makeSut([], {
      id: 'admin-123',
      role: 'ADMIN',
    });

    await expect(middleware(request, response, next)).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    expect(next).not.toHaveBeenCalled();
  });

  it('should propagate errors thrown by subsequent handlers', async () => {
    const { request, response, next, middleware } = makeSut(['ADMIN'], {
      id: 'admin-123',
      role: 'ADMIN',
    });
    const expectedError = new Error('Controller failed');
    next.mockRejectedValueOnce(expectedError);

    await expect(middleware(request, response, next)).rejects.toBe(expectedError);

    expect(next).toHaveBeenCalledOnce();
  });
});
