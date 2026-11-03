import { sendJson } from '@/presentation/http/responses/send-json';
import { presentOrder } from '@/presentation/http/presenters/order-presenter';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { orderIdParamsSchema } from '@/presentation/http/validation/orders/order-schemas';

import type { GetOrderUseCase } from '@/application/use-cases/orders/get-order';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

class GetOrderController {
  constructor(private readonly getOrderUseCase: GetOrderUseCase) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor, params } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const { orderId } = orderIdParamsSchema.parse(params);

    const order = await this.getOrderUseCase.execute({ actor, orderId });

    sendJson({
      response,
      statusCode: 200,
      body: { success: true, data: presentOrder(order), error: null },
    });
  };
}

export { GetOrderController };
