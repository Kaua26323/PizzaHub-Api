import { sendJson } from '@/presentation/http/responses/send-json';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { AuthenticationError } from '@/application/errors/authentication-error';

import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';
import type { ListCategoriesUseCase } from '@/application/use-cases/catalog/list-categories';
import type { CategoryOutputDTO } from '../../dtos/catalog/categories/category-output-dto';

export type ListCategoriesResponseDTO = CategoryOutputDTO[];

class ListCategoriesController {
  constructor(private readonly listCategoriesUseCase: ListCategoriesUseCase) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const categories = await this.listCategoriesUseCase.execute(actor);

    sendJson<ListCategoriesResponseDTO>({
      response,
      statusCode: 200,
      body: {
        success: true,
        data: categories,
        error: null,
      },
    });
  };
}

export { ListCategoriesController };
