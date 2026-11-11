import { EventEmitter } from 'node:events';
import { createServer, type Server } from 'node:http';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerShutdownHandlers, startServer, stopServer } from '@/main/server';

const SHUTDOWN_TIMEOUT_MS = 10_000;

function createDatabase() {
  return {
    query: vi.fn(async () => {}),
    end: vi.fn(async () => {}),
  };
}

async function startTestServer(database = createDatabase()): Promise<Server> {
  return startServer({
    database,
    createServer: () => createServer(),
    port: 0,
    host: '127.0.0.1',
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Production server lifecycle', () => {
  describe('Startup', () => {
    it('waits for PostgreSQL before creating and listening on the HTTP server', async () => {
      let resolveReadiness!: () => void;

      const readiness = new Promise<void>((resolve) => {
        resolveReadiness = resolve;
      });

      const database = createDatabase();
      database.query.mockImplementation(() => readiness);

      const createHttpServer = vi.fn(() => createServer());

      const starting = startServer({
        database,
        createServer: createHttpServer,
        port: 0,
        host: '127.0.0.1',
      });

      expect(database.query).toHaveBeenCalledExactlyOnceWith('SELECT 1');
      expect(createHttpServer).not.toHaveBeenCalled();

      resolveReadiness();

      const server = await starting;

      try {
        expect(createHttpServer).toHaveBeenCalledOnce();
        expect(server.listening).toBe(true);
        expect(database.end).not.toHaveBeenCalled();
      } finally {
        await stopServer(server, database);
      }

      expect(database.end).toHaveBeenCalledOnce();
    });

    it('closes PostgreSQL and rejects when database readiness fails', async () => {
      const database = createDatabase();
      const failure = new Error('PostgreSQL unavailable');

      database.query.mockRejectedValueOnce(failure);

      const createHttpServer = vi.fn(() => createServer());

      await expect(
        startServer({
          database,
          createServer: createHttpServer,
          port: 0,
          host: '127.0.0.1',
        }),
      ).rejects.toBe(failure);

      expect(createHttpServer).not.toHaveBeenCalled();
      expect(database.end).toHaveBeenCalledOnce();
    });

    it('closes PostgreSQL when the HTTP port is already in use', async () => {
      const occupyingServer = createServer();

      await new Promise<void>((resolve) => {
        occupyingServer.listen(0, '127.0.0.1', resolve);
      });

      try {
        const address = occupyingServer.address();

        if (!address || typeof address === 'string') {
          throw new Error('Expected a TCP address.');
        }

        const database = createDatabase();

        await expect(
          startServer({
            database,
            createServer: () => createServer(),
            port: address.port,
            host: '127.0.0.1',
          }),
        ).rejects.toMatchObject({
          code: 'EADDRINUSE',
        });

        expect(database.query).toHaveBeenCalledWith('SELECT 1');
        expect(database.end).toHaveBeenCalledOnce();
      } finally {
        await new Promise<void>((resolve, reject) => {
          occupyingServer.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }
    });
  });

  describe('Shutdown', () => {
    it('closes the HTTP server and PostgreSQL successfully', async () => {
      const database = createDatabase();
      const server = await startTestServer(database);

      expect(server.listening).toBe(true);

      await stopServer(server, database);

      expect(server.listening).toBe(false);
      expect(database.end).toHaveBeenCalledOnce();
    });

    it('waits for HTTP shutdown before closing PostgreSQL', async () => {
      const database = createDatabase();

      let finishClosing!: () => void;

      const server = {
        close: vi.fn((callback: (error?: Error) => void) => {
          finishClosing = () => callback();
        }),
        closeAllConnections: vi.fn(),
      } as unknown as Server;

      const stopping = stopServer(server, database);

      expect(server.close).toHaveBeenCalledOnce();
      expect(database.end).not.toHaveBeenCalled();

      finishClosing();

      await stopping;

      expect(database.end).toHaveBeenCalledOnce();
      expect(server.closeAllConnections).not.toHaveBeenCalled();
    });

    it('closes PostgreSQL even when HTTP shutdown fails', async () => {
      const database = createDatabase();
      const failure = new Error('HTTP shutdown failed');

      const server = {
        close: vi.fn((callback: (error?: Error) => void) => {
          callback(failure);
        }),
        closeAllConnections: vi.fn(),
      } as unknown as Server;

      await expect(stopServer(server, database)).rejects.toBe(failure);

      expect(server.close).toHaveBeenCalledOnce();
      expect(database.end).toHaveBeenCalledOnce();
    });

    it('forces HTTP connection cleanup after the shutdown timeout', async () => {
      vi.useFakeTimers();

      const database = createDatabase();

      let finishClosing!: () => void;

      const server = {
        close: vi.fn((callback: (error?: Error) => void) => {
          finishClosing = () => callback();
        }),
        closeAllConnections: vi.fn(() => {
          finishClosing();
        }),
      } as unknown as Server;

      try {
        const stopping = stopServer(server, database);

        expect(server.close).toHaveBeenCalledOnce();
        expect(server.closeAllConnections).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(SHUTDOWN_TIMEOUT_MS - 1);

        expect(server.closeAllConnections).not.toHaveBeenCalled();
        expect(database.end).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);

        expect(server.closeAllConnections).toHaveBeenCalledOnce();

        await stopping;

        expect(database.end).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });

    it('cancels the shutdown timeout when HTTP closes normally', async () => {
      vi.useFakeTimers();

      const database = createDatabase();

      let finishClosing!: () => void;

      const server = {
        close: vi.fn((callback: (error?: Error) => void) => {
          finishClosing = () => callback();
        }),
        closeAllConnections: vi.fn(),
      } as unknown as Server;

      try {
        const stopping = stopServer(server, database);

        finishClosing();
        await stopping;

        await vi.advanceTimersByTimeAsync(SHUTDOWN_TIMEOUT_MS);

        expect(server.closeAllConnections).not.toHaveBeenCalled();
        expect(database.end).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Process signals', () => {
    it.each(['SIGINT', 'SIGTERM'] as const)(
      'closes HTTP and PostgreSQL after receiving %s',
      async (signal) => {
        const database = createDatabase();
        const server = await startTestServer(database);
        const signals = new EventEmitter();

        registerShutdownHandlers(server, signals, database);

        signals.emit(signal);

        await vi.waitFor(() => {
          expect(server.listening).toBe(false);
          expect(database.end).toHaveBeenCalledOnce();
        });

        expect(signals.listenerCount('SIGINT')).toBe(0);
        expect(signals.listenerCount('SIGTERM')).toBe(0);
      },
    );

    it('does not execute shutdown twice when another signal is received', async () => {
      const database = createDatabase();
      const server = await startTestServer(database);
      const signals = new EventEmitter();

      registerShutdownHandlers(server, signals, database);

      signals.emit('SIGINT');
      signals.emit('SIGTERM');

      await vi.waitFor(() => {
        expect(server.listening).toBe(false);
        expect(database.end).toHaveBeenCalledOnce();
      });

      expect(database.end).toHaveBeenCalledOnce();

      expect(signals.listenerCount('SIGINT')).toBe(0);
      expect(signals.listenerCount('SIGTERM')).toBe(0);
    });
  });
});
