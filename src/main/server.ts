import path from 'node:path';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';

import { createApplicationRoutes } from './routes';

import { env } from '@/infrastructure/config/env';
import { pool } from '@/infrastructure/database/postgres/connection/pool';

import { Router } from '@/presentation/http/routes/router';
import { errorHandler } from '@/presentation/http/errors/error-handler';
import { createHttpServer } from '@/presentation/http/server/create-http-server';
import { browserSecurity } from '@/presentation/http/middlewares/browser-security';

const SHUTDOWN_TIMEOUT_MS = 10_000;

export function createApplicationServer(
  applicationRouter: Router = createApplicationRoutes(),
): Server {
  return createHttpServer(async (request, response) => {
    return Promise.resolve()
      .then(() => {
        if (browserSecurity(request, response, env.WEB_ORIGIN)) return;
        return applicationRouter.handle(request, response);
      })
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

interface DatabaseLifecycle {
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
}

interface StartServerOptions {
  database?: DatabaseLifecycle;
  createServer?: () => Server;
  port?: number;
  host?: string;
}

interface SignalSource {
  once(signal: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  off(signal: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleStartupError = (error: Error): void => reject(error);

    server.once('error', handleStartupError);
    server.listen(port, host, () => {
      server.off('error', handleStartupError);
      resolve();
    });
  });
}

export async function startServer({
  database = pool,
  port = env.PORT,
  host = '0.0.0.0',
  createServer = createApplicationServer,
}: StartServerOptions = {}): Promise<Server> {
  try {
    await database.query('SELECT 1');

    const server = createServer();

    await listen(server, port, host);
    console.log(`Pizza Hub API running on port ${port}`);

    return server;
  } catch (error) {
    try {
      await database.end();
    } catch (cleanupError) {
      console.error('Failed to close PostgreSQL after startup failure:', cleanupError);
    }

    throw error;
  }
}

export async function stopServer(
  server: Server,
  database: DatabaseLifecycle = pool,
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    await new Promise<void>((resolve, reject) => {
      timeout = setTimeout(() => {
        server.closeAllConnections();
      }, SHUTDOWN_TIMEOUT_MS);

      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  } finally {
    if (timeout) clearTimeout(timeout);

    await database.end();
  }
}

export function registerShutdownHandlers(
  server: Server,
  signals: SignalSource = process,
  database: DatabaseLifecycle = pool,
): void {
  const shutdown = async (signal: 'SIGINT' | 'SIGTERM') => {
    signals.off('SIGINT', onSigint);
    signals.off('SIGTERM', onSigterm);
    console.log(`Received ${signal}; shutting down Pizza Hub API.`);

    try {
      await stopServer(server, database);
    } catch (error: unknown) {
      console.error('PizzaHub API failed to shut down:', error);
      process.exitCode = 1;
    }
  };

  const onSigint = (): void => {
    void shutdown('SIGINT');
  };

  const onSigterm = (): void => {
    void shutdown('SIGTERM');
  };

  signals.once('SIGINT', onSigint);
  signals.once('SIGTERM', onSigterm);
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
  startServer()
    .then((server) => registerShutdownHandlers(server))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown startup error.';
      console.error(`PizzaHub API failed to start: ${message}`);
      process.exitCode = 1;
    });
}
