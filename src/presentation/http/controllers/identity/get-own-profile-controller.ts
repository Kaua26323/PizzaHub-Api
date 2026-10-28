import { sendJson } from '../../responses/send-json';
import { getRequestContext } from '../../request/request-context';

import { AuthenticationError } from '@/application/errors/authentication-error';

import type { HttpRequestHandler } from '../../server/create-http-server';
import type { GetOwnProfileUseCase } from '@/application/use-cases/identity/get-own-profile';
import type { UserResponseDTO } from '../dtos/identity/user-response-dto';

export type GetOwnProfileResponseDTO = UserResponseDTO;

class GetOwnProfileController {
  constructor(private readonly getOwnProfileUseCase: GetOwnProfileUseCase) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const userInfo = await this.getOwnProfileUseCase.execute(actor);

    sendJson<GetOwnProfileResponseDTO>({
      response,
      statusCode: 200,
      body: {
        success: true,
        data: {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
          role: userInfo.role,
          createdAt: userInfo.createdAt,
          updatedAt: userInfo.updatedAt,
        },
        error: null,
      },
    });
  };
}
export { GetOwnProfileController };
