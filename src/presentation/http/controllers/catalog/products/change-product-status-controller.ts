import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { AuthenticationError } from '@/application/errors/authentication-error';

import { jsonBodyParser } from '@/presentation/http/parsers/json-body-parser';
import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';
import type { ChangeProductStatusUseCase } from '@/application/use-cases/catalog/change-product-status';

import {
  productIdParamsSchema,
  changeProductStatusSchema,
} from '@/presentation/http/validation/catalog/product-schemas';

class ChangeProductStatusController {
  constructor(
    private readonly changeProductStatusUseCase: ChangeProductStatusUseCase,
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

    const { productId } = productIdParamsSchema.parse(params);

    const body = await jsonBodyParser({ request, ...this.jsonBodyParserOptions });

    const parsedBody = changeProductStatusSchema.parse(body);

    await this.changeProductStatusUseCase.execute({
      actor,
      isActive: parsedBody.isActive,
      productId,
    });

    sendNoContent(response);
  };
}

export { ChangeProductStatusController };
