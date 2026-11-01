import { sendJson } from '@/presentation/http/responses/send-json';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { listProductsQuerySchema } from '@/presentation/http/validation/catalog/product-schemas';

import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';
import type { ListProductsUseCase } from '@/application/use-cases/catalog/list-products';

class ListProductsController {
  constructor(private readonly listProductsUseCase: ListProductsUseCase) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor, query } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const values: Record<string, string | string[]> = Object.fromEntries(query);

    const categoryIds = query.getAll('categoryId');

    if (categoryIds.length > 1) {
      values.categoryId = categoryIds;
    }

    const { categoryId } = listProductsQuerySchema.parse(values);

    const products = await this.listProductsUseCase.execute({
      actor,
      ...(categoryId && { filters: { categoryId } }),
    });

    sendJson({
      response,
      statusCode: 200,
      body: { success: true, data: products, error: null },
    });
  };
}

export { ListProductsController };
