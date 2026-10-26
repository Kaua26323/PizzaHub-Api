import { describe, expect, it } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { composeMiddlewares } from '@/presentation/http/middlewares/compose-middlewares';

import type { Middleware } from '@/presentation/http/middlewares/compose-middlewares';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

describe('composeMiddlewares', () => {
  it('should execute middlewares in order and continue to the handler', async () => {
    const calls: string[] = [];

    const firstMiddleware: Middleware = async (_request, _response, next) => {
      calls.push('first-before');

      await next();

      calls.push('first-after');
    };

    const secondMiddleware: Middleware = async (_request, _response, next) => {
      calls.push('second-before');

      await next();

      calls.push('second-after');
    };

    const handler: HttpRequestHandler = async () => {
      calls.push('handler');
    };

    const composedHandler = composeMiddlewares(
      [firstMiddleware, secondMiddleware],
      handler,
    );

    const request = {} as IncomingMessage;
    const response = {} as ServerResponse;

    await composedHandler(request, response);

    expect(calls).toEqual([
      'first-before',
      'second-before',
      'handler',
      'second-after',
      'first-after',
    ]);
  });

  it('should stop the pipeline when a middleware does not call next', async () => {
    const calls: string[] = [];

    const firstMiddleware: Middleware = async (_request, _response, next) => {
      calls.push('first');

      await next();
    };

    const shortCircuitMiddleware: Middleware = async () => {
      calls.push('short-circuit');

      // Does not call next()
    };

    const thirdMiddleware: Middleware = async (_request, _response, next) => {
      calls.push('third');

      await next();
    };

    const handler: HttpRequestHandler = async () => {
      calls.push('handler');
    };

    const composedHandler = composeMiddlewares(
      [firstMiddleware, shortCircuitMiddleware, thirdMiddleware],
      handler,
    );

    const request = {} as IncomingMessage;
    const response = {} as ServerResponse;

    await composedHandler(request, response);
    expect(calls).toEqual(['first', 'short-circuit']);
  });

  it('should propagate middleware errors', async () => {
    const middleware: Middleware = async () => {
      throw new Error('Middleware failed');
    };

    const handler: HttpRequestHandler = async () => {};

    const composedHandler = composeMiddlewares([middleware], handler);

    const request = {} as IncomingMessage;
    const response = {} as ServerResponse;

    await expect(composedHandler(request, response)).rejects.toThrow('Middleware failed');
  });

  it('should propagate errors from downstream handlers', async () => {
    const middleware: Middleware = async (_request, _response, next) => {
      await next();
    };

    const handler: HttpRequestHandler = async () => {
      throw new Error('Handler failed');
    };
    const composedHandler = composeMiddlewares([middleware], handler);

    const request = {} as IncomingMessage;
    const response = {} as ServerResponse;

    await expect(composedHandler(request, response)).rejects.toThrow('Handler failed');
  });

  it('should execute the handler directly when there are no middlewares', async () => {
    const calls: string[] = [];

    const handler: HttpRequestHandler = async () => {
      calls.push('handler');
    };

    const composedHandler = composeMiddlewares([], handler);

    const request = {} as IncomingMessage;
    const response = {} as ServerResponse;

    await composedHandler(request, response);

    expect(calls).toEqual(['handler']);
  });
});
