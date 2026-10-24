import { describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { authenticate } from '@/presentation/http/middlewares/authenticate';
import { AuthenticationError } from '@/application/errors/authentication-error';

import type {
  AccessTokenClaims,
  AccessTokenProvider,
} from '@/application/services/access-token-provider';

import {
  parseRequestUrl,
  getRequestContext,
  setRequestContext,
  createRequestContext,
} from '@/presentation/http/request/request-context';

const claims: AccessTokenClaims = {
  userId: '00000000-0000-4000-8000-000000000001',
  role: 'STAFF',
};

function makeSut(authorization?: string) {
  const request = {
    headers: authorization === undefined ? {} : { authorization },
  } as IncomingMessage;

  const response = {} as ServerResponse;
  const context = createRequestContext(parseRequestUrl('/users/me'), '/users/me');
  setRequestContext(request, context);

  const accessTokenProvider: AccessTokenProvider = {
    issue: vi.fn(async () => 'unused-token'),
    verify: vi.fn(async () => claims),
  };

  const next = vi.fn(async (): Promise<void> => {});
  const middleware = authenticate(accessTokenProvider);

  return { request, response, next, middleware, accessTokenProvider };
}

describe('authenticate', () => {
  it('should reject requests without an authorization header', async () => {
    const { middleware, request, response, next, accessTokenProvider } = makeSut();

    await expect(middleware(request, response, next)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });

    expect(accessTokenProvider.verify).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(getRequestContext(request).actor).toBeUndefined();
  });

  it.each([
    'Basic token-123',
    'Bearer',
    'Bearer ',
    'Bearer token-123 extra',
    'Bearer  token-123',
  ])('should reject malformed authorization header: %s', async (authorization) => {
    const { middleware, request, response, next, accessTokenProvider } =
      makeSut(authorization);

    await expect(middleware(request, response, next)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });

    expect(accessTokenProvider.verify).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should store the authenticated actor and call next for a valid bearer token', async () => {
    const { middleware, request, response, next, accessTokenProvider } =
      makeSut('Bearer valid-token');

    await middleware(request, response, next);

    expect(accessTokenProvider.verify).toHaveBeenCalledExactlyOnceWith('valid-token');
    expect(getRequestContext(request).actor).toEqual({
      id: claims.userId,
      role: claims.role,
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it.each([
    ['INVALID_ACCESS_TOKEN', 'Invalid access token.'],
    ['ACCESS_TOKEN_EXPIRED', 'Access token has expired.'],
  ] as const)('should propagate the %s authentication error', async (code, message) => {
    const { middleware, request, response, next, accessTokenProvider } =
      makeSut('Bearer invalid-token');
    const expectedError = new AuthenticationError(code, message);
    vi.mocked(accessTokenProvider.verify).mockRejectedValueOnce(expectedError);

    await expect(middleware(request, response, next)).rejects.toBe(expectedError);

    expect(next).not.toHaveBeenCalled();
    expect(getRequestContext(request).actor).toBeUndefined();
  });

  it('should propagate unexpected access token provider errors', async () => {
    const { middleware, request, response, next, accessTokenProvider } = makeSut(
      'Bearer valid-format-token',
    );
    const expectedError = new Error('Unexpected provider failure');
    vi.mocked(accessTokenProvider.verify).mockRejectedValueOnce(expectedError);

    await expect(middleware(request, response, next)).rejects.toBe(expectedError);

    expect(next).not.toHaveBeenCalled();
    expect(getRequestContext(request).actor).toBeUndefined();
  });

  it('should propagate errors thrown by subsequent handlers', async () => {
    const { middleware, request, response, next } = makeSut('Bearer valid-token');
    const expectedError = new Error('Controller failed');
    next.mockRejectedValueOnce(expectedError);

    await expect(middleware(request, response, next)).rejects.toBe(expectedError);

    expect(next).toHaveBeenCalledOnce();
    expect(getRequestContext(request).actor).toEqual({
      id: claims.userId,
      role: claims.role,
    });
  });
});
