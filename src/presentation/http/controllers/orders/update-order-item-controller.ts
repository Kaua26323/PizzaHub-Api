import { AuthenticationError } from '@/application/errors/authentication-error';
import { jsonBodyParser } from '@/presentation/http/parsers/json-body-parser';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import {
  orderItemIdParamsSchema,
  updateOrderItemSchema,
} from '@/presentation/http/validation/orders/order-item-schemas';

import type { UpdateOrderItemUseCase } from '@/application/use-cases/orders/update-order-item';
import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

class UpdateOrderItemController {
  constructor(
    private readonly updateOrderItemUseCase: UpdateOrderItemUseCase,
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

    const { orderId, itemId } = orderItemIdParamsSchema.parse(params);
    const body = await jsonBodyParser({ request, ...this.jsonBodyParserOptions });
    const { quantity, notes } = updateOrderItemSchema.parse(body);

    await this.updateOrderItemUseCase.execute({
      actor,
      orderId,
      itemId,
      changes: {
        ...(quantity !== undefined && { quantity }),
        ...(notes !== undefined && { notes }),
      },
    });

    sendNoContent(response);
  };
}

export { UpdateOrderItemController };
