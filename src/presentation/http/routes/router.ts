import type { ServerResponse } from 'node:http';
import type { HttpRequestHandler } from '../server/create-http-server';

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

class Router {
  private readonly routes: Route[] = [];

  public handle: HttpRequestHandler = async (request, response) => {
    const method = request.method;
    const pathname = request.url;

    if (!method || !pathname) {
      return temporaryNotFoundResponse(response);
    }

    const route = this.findRoute(method, pathname);

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
