import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { categoryIdParamsSchema } from '@/presentation/http/validation/catalog/category-schema';

import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';
import type { DeleteCategoryUseCase } from '@/application/use-cases/catalog/delete-category';

class DeleteCategoryController {
  constructor(private readonly deleteCategoryUseCase: DeleteCategoryUseCase) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor, params } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const { categoryId } = categoryIdParamsSchema.parse(params);

    await this.deleteCategoryUseCase.execute({ actor, categoryId });

    sendNoContent(response);
  };
}

export { DeleteCategoryController };
