import { sendJson } from '@/presentation/http/responses/send-json';
import { jsonBodyParser } from '@/presentation/http/parsers/json-body-parser';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { AuthenticationError } from '@/application/errors/authentication-error';
import { createOrderSchema } from '@/presentation/http/validation/orders/order-schemas';

import type { CreateOrderUseCase } from '@/application/use-cases/orders/create-order';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';
import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

class CreateOrderController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
  ) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const body = await jsonBodyParser({ request, ...this.jsonBodyParserOptions });

    const { tableNumber, customerName } = createOrderSchema.parse(body);

    await this.createOrderUseCase.execute({
      actor,
      tableNumber,
      ...(customerName !== undefined && { customerName }),
    });

    sendJson({
      response,
      statusCode: 201,
      body: { success: true, data: null, error: null },
    });
  };
}

export { CreateOrderController };
