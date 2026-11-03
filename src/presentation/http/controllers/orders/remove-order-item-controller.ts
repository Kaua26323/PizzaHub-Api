import { AuthenticationError } from '@/application/errors/authentication-error';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import { orderItemIdParamsSchema } from '@/presentation/http/validation/orders/order-item-schemas';

import type { RemoveOrderItemUseCase } from '@/application/use-cases/orders/remove-order-item';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

class RemoveOrderItemController {
  constructor(private readonly removeOrderItemUseCase: RemoveOrderItemUseCase) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor, params } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const { orderId, itemId } = orderItemIdParamsSchema.parse(params);
    await this.removeOrderItemUseCase.execute({ actor, orderId, itemId });

    sendNoContent(response);
  };
}

export { RemoveOrderItemController };
