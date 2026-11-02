import { AuthenticationError } from '@/application/errors/authentication-error';
import { jsonBodyParser } from '@/presentation/http/parsers/json-body-parser';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { sendJson } from '@/presentation/http/responses/send-json';
import { addOrderItemSchema } from '@/presentation/http/validation/orders/order-item-schemas';
import { orderIdParamsSchema } from '@/presentation/http/validation/orders/order-schemas';

import type { AddOrderItemUseCase } from '@/application/use-cases/orders/add-order-item';
import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

class AddOrderItemController {
  constructor(
    private readonly addOrderItemUseCase: AddOrderItemUseCase,
    private readonly jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
  ) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor, params } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const { orderId } = orderIdParamsSchema.parse(params);
    const body = await jsonBodyParser({ request, ...this.jsonBodyParserOptions });
    const { productId, quantity, notes } = addOrderItemSchema.parse(body);

    await this.addOrderItemUseCase.execute({
      actor,
      orderId,
      productId,
      item: { quantity, ...(notes !== undefined && { notes }) },
    });

    sendJson({
      response,
      statusCode: 201,
      body: { success: true, data: null, error: null },
    });
  };
}

export { AddOrderItemController };
