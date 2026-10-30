import { sendJson } from '../../responses/send-json';
import { loginSchema } from '@/presentation/http/validation/identity/login-schema';
import { createRefreshTokenCookie } from '../../validation/identity/refresh-token-transport';

import { jsonBodyParser } from '../../parsers/json-body-parser';
import type { JsonBodyParserOptions } from '../../parsers/json-body-parser';

import type { HttpRequestHandler } from '../../server/create-http-server';
import type { AuthenticateUserUseCase } from '@/application/use-cases/identity/authenticate-user';
import type { AuthenticateUserResponseDTO } from '../dtos/identity/user-response-dto';

class AuthenticateUserController {
  constructor(
    private readonly production: boolean,
    private readonly accessTokenTtlSeconds: number,
    private readonly refreshTokenTtlSeconds: number,
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
    private readonly jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
  ) {}

  handler: HttpRequestHandler = async (request, response) => {
    const body = await jsonBodyParser({
      request,
      ...this.jsonBodyParserOptions,
    });

    const validatedData = loginSchema.parse(body);

    const result = await this.authenticateUserUseCase.execute({
      email: validatedData.email,
      password: validatedData.password,
    });

    const cookie = createRefreshTokenCookie(
      result.refreshToken,
      this.production,
      this.refreshTokenTtlSeconds,
    );

    response.setHeader('Set-Cookie', cookie);

    sendJson<AuthenticateUserResponseDTO>({
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

export { AuthenticateUserController };
