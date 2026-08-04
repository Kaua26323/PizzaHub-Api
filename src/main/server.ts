import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';

import { env } from '@/infrastructure/config/env';

export function createHttpServer(): Server {
  return createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.statusCode = 200;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          success: true,
          data: {
            status: 'ok',
          },
          error: null,
        }),
      );

      return;
    }

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
  });
}

export async function startServer(): Promise<Server> {
  const server = createHttpServer();

  return new Promise((resolve, reject) => {
    const handleStartupError = (error: Error): void => reject(error);

    server.once('error', handleStartupError);
    server.listen(env.PORT, '0.0.0.0', () => {
      server.off('error', handleStartupError);
      console.log(`Pizza Hub API running on port ${env.PORT}`);

      resolve(server);
    });
  });
}

function isMainModule(): boolean {
  const entryFile = process.argv[1];

  if (entryFile === undefined) {
    return false;
  }

  const currentFile = fileURLToPath(import.meta.url);
  return currentFile === path.resolve(entryFile);
}

if (isMainModule()) {
  startServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown startup error.';
    console.error(`PizzaHub API failed to start: ${message}`);
    process.exitCode = 1;
  });
}
