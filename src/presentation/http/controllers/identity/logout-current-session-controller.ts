import { sendNoContent } from '../../responses/send-no-content';

import {
  readRefreshToken,
  createClearRefreshTokenCookie,
} from '../../validation/identity/refresh-token-transport';

import type { HttpRequestHandler } from '../../server/create-http-server';
import type { LogoutCurrentSessionUseCase } from '@/application/use-cases/identity/logout-current-session';

class LogoutCurrentSessionController {
  constructor(
    private readonly production: boolean,
    private readonly logoutCurrentSessionUserUseCase: LogoutCurrentSessionUseCase,
  ) {}

  handler: HttpRequestHandler = async (request, response) => {
    const refreshToken = readRefreshToken(request, this.production);

    await this.logoutCurrentSessionUserUseCase.execute(refreshToken);

    const clearCookie = createClearRefreshTokenCookie(this.production);

    response.setHeader('Set-Cookie', clearCookie);

    sendNoContent(response);
  };
}

export { LogoutCurrentSessionController };
