import { sendJson } from '../../responses/send-json';
import { getRequestContext } from '../../request/request-context';

import { AuthenticationError } from '@/application/errors/authentication-error';

import type { HttpRequestHandler } from '../../server/create-http-server';
import type { UserResponseDTO } from '../dtos/identity/user-response-dto';
import type { ListUsersUseCase } from '@/application/use-cases/identity/list-users';

export type ListUsersResponseDTO = UserResponseDTO[];

class ListUsersController {
  constructor(private readonly listUsersUseCase: ListUsersUseCase) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const users = await this.listUsersUseCase.execute(actor);

    sendJson<ListUsersResponseDTO>({
      response,
      statusCode: 200,
      body: {
        success: true,
        data: users,
        error: null,
      },
    });
  };
}

export { ListUsersController };
