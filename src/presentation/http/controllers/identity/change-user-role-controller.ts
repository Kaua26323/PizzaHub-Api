import { sendNoContent } from '../../responses/send-no-content';
import { getRequestContext } from '../../request/request-context';
import { AuthenticationError } from '@/application/errors/authentication-error';

import type { HttpRequestHandler } from '../../server/create-http-server';
import type { ChangeUserRoleUseCase } from '@/application/use-cases/identity/change-user-role';

import { jsonBodyParser } from '../../parsers/json-body-parser';
import type { JsonBodyParserOptions } from '../../parsers/json-body-parser';

import {
  userIdParamsSchema,
  changeUserRoleSchema,
} from '../../validation/identity/identity-route-schemas';

class ChangeUserRoleController {
  constructor(
    private readonly changeUserRoleUseCase: ChangeUserRoleUseCase,
    private readonly jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
  ) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor, params } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const { userId } = userIdParamsSchema.parse(params);

    const body = await jsonBodyParser({
      request,
      ...this.jsonBodyParserOptions,
    });

    const { role } = changeUserRoleSchema.parse(body);

    await this.changeUserRoleUseCase.execute({
      actor,
      targetRole: role,
      targetUserId: userId,
    });

    sendNoContent(response);
  };
}

export { ChangeUserRoleController };
