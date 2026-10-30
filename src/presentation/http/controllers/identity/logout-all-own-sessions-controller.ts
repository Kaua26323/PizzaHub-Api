import { sendNoContent } from '../../responses/send-no-content';
import { getRequestContext } from '../../request/request-context';

import { AuthenticationError } from '@/application/errors/authentication-error';
import { createClearRefreshTokenCookie } from '../../validation/identity/refresh-token-transport';

import type { HttpRequestHandler } from '../../server/create-http-server';
import type { LogoutAllOwnSessionsUseCase } from '@/application/use-cases/identity/logout-all-own-sessions';

class LogoutAllOwnSessionController {
  constructor(
    private readonly production: boolean,
    private readonly logoutAllOwnSessionUserUseCase: LogoutAllOwnSessionsUseCase,
  ) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    await this.logoutAllOwnSessionUserUseCase.execute(actor);

    const clearCookie = createClearRefreshTokenCookie(this.production);

    response.setHeader('Set-Cookie', clearCookie);

    sendNoContent(response);
  };
}

export { LogoutAllOwnSessionController };
