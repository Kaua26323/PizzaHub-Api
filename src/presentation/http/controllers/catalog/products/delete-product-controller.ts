import { getRequestContext } from '@/presentation/http/request/request-context';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { productIdParamsSchema } from '@/presentation/http/validation/catalog/product-schemas';

import type { DeleteProductUseCase } from '@/application/use-cases/catalog/delete-product';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';
import { sendNoContent } from '@/presentation/http/responses/send-no-content';

class DeleteProductController {
  constructor(private readonly deleteProductUseCase: DeleteProductUseCase) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor, params } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const { productId } = productIdParamsSchema.parse(params);

    await this.deleteProductUseCase.execute({ actor, productId });

    sendNoContent(response);
  };
}

export { DeleteProductController };
