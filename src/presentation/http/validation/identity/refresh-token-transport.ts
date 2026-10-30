import { z } from 'zod';
import type { IncomingMessage } from 'node:http';

import { AuthenticationError } from '@/application/errors/authentication-error';

const refreshTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function refreshCookieName(production: boolean): string {
  return production ? '__Host-pizzahub_refresh' : 'pizzahub_refresh';
}

/** Browser and native clients use a cookie; native clients keep it in a secure cookie store. */
export function readRefreshToken(request: IncomingMessage, production: boolean): string {
  const cookieName = refreshCookieName(production);
  const matches = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${cookieName}=`))
    .map((part) => part.slice(cookieName.length + 1));

  if (matches.length !== 1) {
    throw new AuthenticationError('INVALID_REFRESH_TOKEN', 'Invalid refresh token.');
  }

  const parsed = refreshTokenSchema.safeParse(matches[0]);

  if (!parsed.success) {
    throw new AuthenticationError('INVALID_REFRESH_TOKEN', 'Invalid refresh token.');
  }

  return parsed.data;
}

export function createRefreshTokenCookie(
  token: string,
  production: boolean,
  remainingSessionSeconds: number,
): string {
  const parsed = refreshTokenSchema.parse(token);

  if (!Number.isSafeInteger(remainingSessionSeconds) || remainingSessionSeconds < 0) {
    throw new Error('Remaining refresh-session lifetime is invalid.');
  }

  return [
    `${refreshCookieName(production)}=${parsed}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${remainingSessionSeconds}`,
    ...(production ? ['Secure'] : []),
  ].join('; ');
}

export function createClearRefreshTokenCookie(production: boolean): string {
  return [
    `${refreshCookieName(production)}=`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=0',
    ...(production ? ['Secure'] : []),
  ].join('; ');
}
