import type { Server } from 'node:http';
import { describe, expect, it } from 'vitest';

import { createHttpServer } from '@/main/server';

async function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleError = (error: Error): void => reject(error);

    server.once('error', handleError);

    server.listen(0, '127.0.0.1', () => {
      server.off('error', handleError);
      resolve();
    });
  });
}

async function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

describe('Application startup', () => {
  it('starts the HTTP server and responds to the health check', async () => {
    const server = createHttpServer();

    await listen(server);
    try {
      const address = server.address();

      if (address === null || typeof address === 'string') {
        throw new Error('The  HTTP server did not expose a TCP address.');
      }

      const { port } = address;

      const response = await fetch(`http://127.0.0.1:${port}/health`);

      expect(response.status).toBe(200);

      await expect(response.json()).resolves.toEqual({
        success: true,
        data: {
          status: 'ok',
        },
        error: null,
      });
    } finally {
      await close(server);
    }
  });
});
