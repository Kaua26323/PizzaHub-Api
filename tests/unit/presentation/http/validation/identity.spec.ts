import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'node:http';

import { loginSchema } from '@/presentation/http/validation/identity/login-schema';
import { registerSchema } from '@/presentation/http/validation/identity/register-schema';

import {
  readRefreshToken,
  createRefreshTokenCookie,
  createClearRefreshTokenCookie,
} from '@/presentation/http/validation/identity/refresh-token-transport';

import {
  userIdParamsSchema,
  changeUserRoleSchema,
} from '@/presentation/http/validation/identity/identity-route-schemas';

const token = 'a'.repeat(43);

function request(cookie: string | undefined): IncomingMessage {
  return {
    headers: {
      cookie,
    },
  } as unknown as IncomingMessage;
}

describe('identity route schemas', () => {
  it('should normalize registration input and reject role injection', () => {
    expect(
      registerSchema.parse({
        name: ' Alice ',
        email: ' ALICE@EXAMPLE.COM ',
        password: 'secret123',
      }),
    ).toEqual({ name: 'Alice', email: 'alice@example.com', password: 'secret123' });

    expect(
      registerSchema.safeParse({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secret123',
        role: 'ADMIN',
      }).success,
    ).toBe(false);

    expect(
      registerSchema.safeParse({
        name: ' ',
        email: 'alice@example.com',
        password: 'secret123',
      }).success,
    ).toBe(false);
  });

  it('should accept existing login passwords without imposing registration length rules', () => {
    expect(
      loginSchema.parse({ email: ' ALICE@EXAMPLE.COM ', password: 'short' }),
    ).toEqual({
      email: 'alice@example.com',
      password: 'short',
    });

    expect(
      loginSchema.safeParse({ email: 'alice@example.com', password: '' }).success,
    ).toBe(false);
  });

  it('should validate user IDs and role updates', () => {
    const userId = 'f3dfba7e-e30b-476a-9c4e-d4c310a74ba2';
    expect(userIdParamsSchema.parse({ userId })).toEqual({ userId });
    expect(userIdParamsSchema.safeParse({ userId: 'bad' }).success).toBe(false);
    expect(changeUserRoleSchema.parse({ role: 'ADMIN' })).toEqual({ role: 'ADMIN' });
    expect(changeUserRoleSchema.safeParse({ role: 'OWNER' }).success).toBe(false);
    expect(changeUserRoleSchema.safeParse({ role: 'STAFF', userId }).success).toBe(false);
  });
});

describe('refresh-token cookie transport', () => {
  it('should set production cookie flags and use remaining session lifetime', () => {
    expect(createRefreshTokenCookie(token, true, 60)).toBe(
      `__Host-pizzahub_refresh=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=60; Secure`,
    );
    expect(createClearRefreshTokenCookie(true)).toBe(
      '__Host-pizzahub_refresh=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure',
    );
  });

  it('should use a valid local-development cookie name without Secure', () => {
    expect(createRefreshTokenCookie(token, false, 60)).toBe(
      `pizzahub_refresh=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=60`,
    );
  });

  it.each([-1, 1.5, NaN, Infinity])(
    'should reject invalid remaining session lifetime: %s',
    (seconds) => {
      expect(() => createRefreshTokenCookie(token, true, seconds)).toThrow(
        'Remaining refresh-session lifetime is invalid.',
      );
    },
  );

  it('should require a single valid cookie', () => {
    expect(
      readRefreshToken(request(`other=x; __Host-pizzahub_refresh=${token}`), true),
    ).toBe(token);

    expect(readRefreshToken(request(`__Host-pizzahub_refresh=${token}`), true)).toBe(
      token,
    );

    expect(() =>
      readRefreshToken(
        request(`__Host-pizzahub_refresh=${token}; __Host-pizzahub_refresh=${token}`),
        true,
      ),
    ).toThrow();

    expect(() =>
      readRefreshToken(request(`__Host-pizzahub_refresh=invalid`), true),
    ).toThrow();

    expect(() => readRefreshToken(request(undefined), true)).toThrow();
  });
});
