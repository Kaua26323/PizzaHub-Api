import path from 'node:path';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';

import { env } from '@/infrastructure/config/env';
import { Router } from '@/presentation/http/routes/router';
import { errorHandler } from '@/presentation/http/errors/error-handler';
import { createHttpServer } from '@/presentation/http/server/create-http-server';
import { createApplicationRoutes } from './routes';

export function createApplicationServer(
  applicationRouter: Router = createApplicationRoutes(),
): Server {
  return createHttpServer(async (request, response) => {
    return applicationRouter
      .handle(request, response)
      .catch((error: unknown) => {
        errorHandler({ error: error, response });
      })
      .catch((handlingError: unknown) => {
        console.error('HTTP error handling failed:', handlingError);

        if (!response.destroyed) {
          response.destroy();
        }
      });
  });
}

export async function startServer(): Promise<Server> {
  const server = createApplicationServer();

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
