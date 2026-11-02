import { sendJson } from '@/presentation/http/responses/send-json';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { categoryBodySchema } from '@/presentation/http/validation/catalog/category-schema';

import { jsonBodyParser } from '@/presentation/http/parsers/json-body-parser';
import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';
import type { CreateCategoryUseCase } from '@/application/use-cases/catalog/create-category';

class CreateCategoryController {
  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
  ) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const body = await jsonBodyParser({ request, ...this.jsonBodyParserOptions });

    const validatedData = categoryBodySchema.parse(body);

    await this.createCategoryUseCase.execute({
      actor,
      categoryName: validatedData.name,
    });

    sendJson({
      response,
      statusCode: 201,
      body: {
        success: true,
        data: null,
        error: null,
      },
    });
  };
}

export { CreateCategoryController };
