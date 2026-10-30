import { sendJson } from '../../responses/send-json';

import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';
import type { RefreshAuthenticationUseCase } from '@/application/use-cases/identity/refresh-authentication';

import {
  readRefreshToken,
  createRefreshTokenCookie,
} from '../../validation/identity/refresh-token-transport';

import type { AuthenticateUserResponseDTO } from '../dtos/identity/user-response-dto';

export type RefreshAuthenticationResponseDTO = AuthenticateUserResponseDTO;

class RefreshAuthenticationController {
  constructor(
    private readonly production: boolean,
    private readonly accessTokenTtlSeconds: number,
    private readonly refreshAuthenticationUserUseCase: RefreshAuthenticationUseCase,
  ) {}

  handler: HttpRequestHandler = async (request, response) => {
    const refreshToken = readRefreshToken(request, this.production);

    const result = await this.refreshAuthenticationUserUseCase.execute(refreshToken);

    const remainingSessionSeconds = Math.max(
      0,
      Math.ceil((result.expiresAt.getTime() - Date.now()) / 1000),
    );

    const cookie = createRefreshTokenCookie(
      result.refreshToken,
      this.production,
      remainingSessionSeconds,
    );

    response.setHeader('Set-Cookie', cookie);

    sendJson<RefreshAuthenticationResponseDTO>({
      response,
      statusCode: 200,
      body: {
        success: true,
        data: {
          accessToken: result.accessToken,
          tokenType: 'Bearer',
          expiresIn: this.accessTokenTtlSeconds,
        },
        error: null,
      },
    });
  };
}

export { RefreshAuthenticationController };
