import type { ServerResponse } from 'node:http';
import type { HttpRequestHandler } from '../server/create-http-server';

import {
  parseRequestUrl,
  setRequestContext,
  RequestContextError,
  createRequestContext,
} from '../request/request-context';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type Route = {
  method: HttpMethod;
  pattern: string;
  handler: HttpRequestHandler;
};

function temporaryNotFoundResponse(response: ServerResponse): void {
  response.statusCode = 404;

  response.setHeader('content-type', 'application/json; charset=utf-8');

  response.end(
    JSON.stringify({
      success: false,
      data: null,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Route not found',
      },
    }),
  );
}

function temporaryBadRequestResponse(
  response: ServerResponse,
  error: RequestContextError,
): void {
  response.statusCode = 400;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(
    JSON.stringify({
      success: false,
      data: null,
      error: { code: error.code, message: error.message },
    }),
  );
}

class Router {
  private readonly routes: Route[] = [];

  public handle: HttpRequestHandler = async (request, response) => {
    const method = request.method;
    const rawUrl = request.url;

    if (!method || !rawUrl) {
      return temporaryNotFoundResponse(response);
    }

    let route: Route | undefined;

    try {
      const parsedUrl = parseRequestUrl(rawUrl);
      route = this.findRoute(method, parsedUrl.pathname);

      if (route) {
        const context = createRequestContext(parsedUrl, route.pattern);

        setRequestContext(request, context);
      }
    } catch (error) {
      if (error instanceof RequestContextError) {
        return temporaryBadRequestResponse(response, error);
      }

      throw error;
    }

    if (!route) {
      return temporaryNotFoundResponse(response);
    }

    await route.handler(request, response);
  };

  public get(pattern: string, handler: HttpRequestHandler): void {
    this.register('GET', pattern, handler);
  }

  public post(pattern: string, handler: HttpRequestHandler): void {
    this.register('POST', pattern, handler);
  }

  public patch(pattern: string, handler: HttpRequestHandler): void {
    this.register('PATCH', pattern, handler);
  }

  public delete(pattern: string, handler: HttpRequestHandler): void {
    this.register('DELETE', pattern, handler);
  }

  private register(
    method: HttpMethod,
    pattern: string,
    handler: HttpRequestHandler,
  ): void {
    this.routes.push({ method, pattern, handler });
  }

  private matchesPath(pattern: string, pathname: string): boolean {
    const patternSegments = pattern.split('/').filter(Boolean);

    const pathSegments = pathname.split('/').filter(Boolean);

    if (patternSegments.length !== pathSegments.length) {
      return false;
    }

    return patternSegments.every((segment, index) => {
      if (segment.startsWith(':')) {
        return true;
      }

      return segment === pathSegments[index];
    });
  }

  private findRoute(method: string, pathname: string): Route | undefined {
    const routes = this.routes.filter((route) => route.method === method);

    const staticRoute = routes.find(
      (route) =>
        !route.pattern.includes(':') && this.matchesPath(route.pattern, pathname),
    );

    if (staticRoute) {
      return staticRoute;
    }

    return routes.find(
      (route) => route.pattern.includes(':') && this.matchesPath(route.pattern, pathname),
    );
  }
}

export { Router };
