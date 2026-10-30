import { jsonBodyParser } from '@/presentation/http/parsers/json-body-parser';
import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { AuthenticationError } from '@/application/errors/authentication-error';

import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';
import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';
import type { UpdateCategoryUseCase } from '@/application/use-cases/catalog/update-category';

import {
  categoryBodySchema,
  categoryIdParamsSchema,
} from '@/presentation/http/validation/catalog/category-schema';

class UpdateCategoryController {
  constructor(
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
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

    const { categoryId } = categoryIdParamsSchema.parse(params);

    const body = await jsonBodyParser({ request, ...this.jsonBodyParserOptions });

    const validatedData = categoryBodySchema.parse(body);

    await this.updateCategoryUseCase.execute({
      actor,
      categoryId,
      categoryName: validatedData.name,
    });

    sendNoContent(response);
  };
}

export { UpdateCategoryController };
