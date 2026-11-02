import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { env } from '@/infrastructure/config/env';
import { setTimeout as delay } from 'node:timers/promises';
import { request as httpRequest, type ClientRequest } from 'node:http';

import {
  admin,
  applicationServer,
  database,
  expectNoTemporaryFiles,
  storedNames,
  temporaryNames,
} from '../helpers/product-api';

async function waitUntil(predicate: () => Promise<boolean>, state: string): Promise<void> {
  const deadline = performance.now() + 5000;
  while (true) {
    if (await predicate()) return;
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw new Error(`Timed out waiting for ${state}.`);
    await delay(Math.min(25, remaining));
  }
}

async function waitForTemporaryFiles(present: boolean): Promise<void> {
  await waitUntil(async () => {
    const names = await temporaryNames();
    if (!present) return names.length === 0;
    const firstName = names[0];
    if (!firstName) return false;
    try {
      return (await stat(join(env.UPLOAD_TEMP_DIRECTORY, firstName))).size > 0;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }, `temporary files to be ${present ? 'written' : 'removed'}`);
}

describe('interrupted product upload', () => {
  it('should remove the partial file and avoid a product record after client disconnect', async () => {
    const server = applicationServer();
    let client: ClientRequest | undefined;

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
          server.off('error', reject);
          resolve();
        });
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing HTTP port.');

      const boundary = 't115-interrupted';
      const body = [
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="pizza.png"\r\n`,
        'Content-Type: image/png\r\n\r\n',
      ].join('');
      client = httpRequest({
        hostname: '127.0.0.1',
        port: address.port,
        method: 'POST',
        path: '/products',
        headers: {
          Authorization: admin(),
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': 1_000_000,
        },
      });
      client.on('error', () => undefined); // Expected when the client disconnects.

      client.write(body);
      client.write(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      client.write(Buffer.alloc(128 * 1024, 1));
      await waitForTemporaryFiles(true);
      client.destroy();
      await waitForTemporaryFiles(false);
      await expectNoTemporaryFiles();
      expect(await storedNames()).toEqual([]);
      expect((await database().query('SELECT id FROM products')).rowCount).toBe(0);
    } finally {
      client?.destroy();
      if (server.listening) {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
      await waitForTemporaryFiles(false);
    }
  }, 15_000);
});
