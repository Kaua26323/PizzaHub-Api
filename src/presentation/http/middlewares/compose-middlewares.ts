import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpRequestHandler } from '../server/create-http-server';

type Next = () => Promise<void>;

export type Middleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: Next,
) => void | Promise<void>;

export function composeMiddlewares(
  middlewares: Middleware[],
  handler: HttpRequestHandler,
): HttpRequestHandler {
  return async (request, response) => {
    async function dispatch(index: number): Promise<void> {
      const middleware = middlewares[index];

      if (!middleware) {
        await handler(request, response);
        return;
      }

      await middleware(request, response, () => dispatch(index + 1));
    }

    await dispatch(0);
  };
}
