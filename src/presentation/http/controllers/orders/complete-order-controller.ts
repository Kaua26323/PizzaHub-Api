import { AuthenticationError } from '@/application/errors/authentication-error';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import { orderIdParamsSchema } from '@/presentation/http/validation/orders/order-schemas';

import type { CompleteOrderUseCase } from '@/application/use-cases/orders/complete-order';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

class CompleteOrderController {
  constructor(private readonly completeOrderUseCase: CompleteOrderUseCase) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor, params } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const { orderId } = orderIdParamsSchema.parse(params);
    await this.completeOrderUseCase.execute({ actor, orderId });

    sendNoContent(response);
  };
}

export { CompleteOrderController };
