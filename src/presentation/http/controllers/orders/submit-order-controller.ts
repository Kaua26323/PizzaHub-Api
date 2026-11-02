import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { orderIdParamsSchema } from '@/presentation/http/validation/orders/order-schemas';

import type { SubmitOrderUseCase } from '@/application/use-cases/orders/submit-order';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

class SubmitOrderController {
  constructor(private readonly submitOrderUseCase: SubmitOrderUseCase) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor, params } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const { orderId } = orderIdParamsSchema.parse(params);
    await this.submitOrderUseCase.execute({ actor, orderId });

    sendNoContent(response);
  };
}

export { SubmitOrderController };
