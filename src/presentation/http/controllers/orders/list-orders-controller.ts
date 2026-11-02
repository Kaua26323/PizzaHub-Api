import { AuthenticationError } from '@/application/errors/authentication-error';
import { presentOrder } from '@/presentation/http/presenters/order-presenter';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { sendJson } from '@/presentation/http/responses/send-json';
import { listOrdersQuerySchema } from '@/presentation/http/validation/orders/order-schemas';

import type { ListOrdersUseCase } from '@/application/use-cases/orders/list-orders';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

class ListOrdersController {
  constructor(private readonly listOrdersUseCase: ListOrdersUseCase) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor, query } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const values: Record<string, string | string[]> = Object.fromEntries(query);
    const statuses = query.getAll('status');

    if (statuses.length > 1) {
      values.status = statuses;
    }

    const { status } = listOrdersQuerySchema.parse(values);
    const orders = await this.listOrdersUseCase.execute({
      actor,
      ...(status && { filters: { status } }),
    });

    sendJson({
      response,
      statusCode: 200,
      body: { success: true, data: orders.map(presentOrder), error: null },
    });
  };
}

export { ListOrdersController };
