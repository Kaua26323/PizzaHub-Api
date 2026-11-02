import { AuthenticationError } from '@/application/errors/authentication-error';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import { orderIdParamsSchema } from '@/presentation/http/validation/orders/order-schemas';

import type { CancelOrderUseCase } from '@/application/use-cases/orders/cancel-order';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

class CancelOrderController {
  constructor(private readonly cancelOrderUseCase: CancelOrderUseCase) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor, params } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const { orderId } = orderIdParamsSchema.parse(params);
    await this.cancelOrderUseCase.execute({ actor, orderId });

    sendNoContent(response);
  };
}

export { CancelOrderController };
