import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';

import { createHttpServer } from '@/presentation/http/server/create-http-server';

describe('createHttpServer', () => {
  it('should create a server using the injected request handler', async () => {
    const server = createHttpServer(async (_request, response) => {
      response.statusCode = 200;
      response.end('test-response');
    });

    expect(server.listening).toBe(false);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    try {
      const address = server.address() as AddressInfo;

      const response = await fetch(`http://127.0.0.1:${address.port}`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('test-response');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});
