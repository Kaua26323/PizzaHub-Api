import { sendJson } from '../responses/send-json';
import type { HttpRequestHandler } from '../server/create-http-server';

import {
  parseRequestUrl,
  setRequestContext,
  createRequestContext,
} from '../request/request-context';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type Route = {
  method: HttpMethod;
  pattern: string;
  handler: HttpRequestHandler;
};

class Router {
  private readonly routes: Route[] = [];

  public handle: HttpRequestHandler = async (request, response) => {
    const method = request.method;
    const rawUrl = request.url;

    if (!method || !rawUrl) {
      return sendJson({
        response,
        statusCode: 400,
        body: {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request URL',
          },
        },
      });
    }

    const parsedUrl = parseRequestUrl(rawUrl);
    const route = this.findRoute(method, parsedUrl.pathname);

    if (!route) {
      return sendJson({
        response,
        statusCode: 404,
        body: {
          success: false,
          data: null,
          error: {
            code: 'ROUTE_NOT_FOUND',
            message: 'Route not found',
          },
        },
      });
    }

    const context = createRequestContext(parsedUrl, route.pattern);
    setRequestContext(request, context);

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
