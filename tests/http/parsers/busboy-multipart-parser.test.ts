import path from 'node:path';
import { tmpdir } from 'node:os';
import { Buffer } from 'node:buffer';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';

import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  busboyMultipartParser,
  BusboyMultipartParserError,
} from '@/presentation/http/parsers/busboy-multipart-parse';

const PNG = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);
const WEBP = Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 ', 'binary');

type ParserOverrides = Partial<{
  maxFields: number;
  maxFileSize: number;
  maxTotalBytes: number;
  requireImage: boolean;
}>;

// The test endpoint returns just public metadata; never expose temporaryPath in an API.
function testServer(directory: string, overrides: ParserOverrides = {}): Server {
  return createServer((request, response) => {
    void (async () => {
      try {
        const parsed = await busboyMultipartParser({
          request,
          temporaryFilePath: directory,
          maxFields: overrides.maxFields ?? 5,
          maxFileSize: overrides.maxFileSize ?? 1024,
          maxTotalBytes: overrides.maxTotalBytes ?? 16 * 1024,
          requireImage: overrides.requireImage ?? true,
        });

        // This is a test-only response. The parser has already completed both pipelines.
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            success: true,
            fields: parsed.fields,
            image: parsed.image && {
              size: parsed.image.size,
              mimeType: parsed.image.mimeType,
              temporaryPath: parsed.image.temporaryPath,
            },
          }),
        );
      } catch (error) {
        if (response.destroyed) return;
        const code =
          error instanceof BusboyMultipartParserError ? error.code : 'INTERNAL_ERROR';

        let status;

        switch (code) {
          case 'FILE_TOO_LARGE':
            status = 413;
            break;
          case 'INTERNAL_ERROR':
            status = 500;
            break;
          case 'UNSUPPORTED_IMAGE_TYPE':
          case 'UNSUPPORTED_CONTENT_TYPE':
            status = 415;
            break;
          default:
            status = 400;
        }

        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ success: false, code }));
      }
    })();
  });
}

async function fileNames(directory: string): Promise<string[]> {
  return readdir(directory);
}

// The assertions use real multipart HTTP requests and a real temporary directory.
describe('busboyMultipartParser — HTTP', () => {
  let directory: string;
  const servers: Server[] = [];

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'pizzahub-multipart-'));
  });

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            if (!server.listening) {
              resolve();
              return;
            }

            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
          }),
      ),
    );

    await rm(directory, { recursive: true, force: true });
  });

  function api(options: ParserOverrides = {}) {
    const server = testServer(directory, options);
    servers.push(server);
    return supertest(server);
  }

  async function expectNoTemporaryFiles(): Promise<void> {
    expect(await fileNames(directory)).toEqual([]);
  }

  it.each([
    ['PNG', PNG, 'image/png', '.png'],
    ['JPEG', JPEG, 'image/jpeg', '.jpg'],
    ['WebP', WEBP, 'image/webp', '.webp'],
  ])(
    'should accept a valid %s and preserve the exact bytes on disk',
    async (_label, bytes, mime, extension) => {
      const response = await api()
        .post('/upload')
        .field('name', 'Pepperoni Pizza')
        .field('price', '45.90')
        .attach('image', bytes, { filename: `image${extension}`, contentType: mime })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.fields).toEqual({ name: 'Pepperoni Pizza', price: '45.90' });
      expect(response.body.image).toMatchObject({ mimeType: mime, size: bytes.length });

      const storedPath: string = response.body.image.temporaryPath;
      expect(path.dirname(storedPath)).toBe(directory);
      expect(path.extname(storedPath)).toBe(extension);
      expect(path.basename(storedPath)).not.toContain('image');
      expect(await readFile(storedPath)).toEqual(bytes);
      expect(await fileNames(directory)).toHaveLength(1);
    },
  );

  it('should accept fields-only requests when requireImage=false', async () => {
    const response = await api({ requireImage: false })
      .post('/upload')
      .field('name', 'Updated pizza')
      .expect(200);
    expect(response.body).toMatchObject({
      success: true,
      fields: { name: 'Updated pizza' },
      image: null,
    });
    await expectNoTemporaryFiles();
  });

  it('should require an image by default', async () => {
    const response = await api().post('/upload').field('name', 'Pizza').expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    await expectNoTemporaryFiles();
  });

  it('should reject an unexpected file field and leave no temporary file', async () => {
    const response = await api()
      .post('/upload')
      .attach('avatar', PNG, { filename: 'image.png', contentType: 'image/png' })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    await expectNoTemporaryFiles();
  });

  it('should reject unsupported MIME types', async () => {
    const response = await api()
      .post('/upload')
      .attach('image', Buffer.from('hello'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(415);
    expect(response.body.code).toBe('UNSUPPORTED_IMAGE_TYPE');
    await expectNoTemporaryFiles();
  });

  it('should reject content whose signature does not match the claimed MIME type', async () => {
    const response = await api()
      .post('/upload')
      .attach('image', JPEG, { filename: 'fake.png', contentType: 'image/png' })
      .expect(415);
    expect(response.body.code).toBe('UNSUPPORTED_IMAGE_TYPE');
    await expectNoTemporaryFiles();
  });

  it('should reject an empty image', async () => {
    const response = await api()
      .post('/upload')
      .attach('image', Buffer.alloc(0), {
        filename: 'empty.png',
        contentType: 'image/png',
      })
      .expect(415);
    expect(response.body.code).toBe('UNSUPPORTED_IMAGE_TYPE');
    await expectNoTemporaryFiles();
  });

  it('should reject fileSize overruns and remove partial files', async () => {
    const response = await api({ maxFileSize: 12 })
      .post('/upload')
      .attach('image', PNG, { filename: 'image.png', contentType: 'image/png' })
      .expect(413);
    expect(response.body.code).toBe('FILE_TOO_LARGE');
    await expectNoTemporaryFiles();
  });

  it('should reject oversized complete multipart bodies', async () => {
    const response = await api({ maxTotalBytes: 30 })
      .post('/upload')
      .attach('image', PNG, { filename: 'image.png', contentType: 'image/png' })
      .expect(413);
    expect(response.body.code).toBe('FILE_TOO_LARGE');
    await expectNoTemporaryFiles();
  });

  it('should reject duplicated text field names and clean up a valid uploaded image', async () => {
    const response = await api()
      .post('/upload')
      .field('name', 'First')
      .field('name', 'Second')
      .attach('image', PNG, { filename: 'image.png', contentType: 'image/png' })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    await expectNoTemporaryFiles();
  });

  it('should reject too many text fields', async () => {
    const response = await api({ maxFields: 1 })
      .post('/upload')
      .field('name', 'First')
      .field('price', '45.90')
      .attach('image', PNG, { filename: 'image.png', contentType: 'image/png' })
      .expect(400);
    expect(response.body.code).toBe('INVALID_MULTIPART_BODY');
    await expectNoTemporaryFiles();
  });

  it('should reject multiple files', async () => {
    const response = await api()
      .post('/upload')
      .attach('image', PNG, { filename: 'first.png', contentType: 'image/png' })
      .attach('image', JPEG, { filename: 'second.jpg', contentType: 'image/jpeg' })
      .expect(400);
    expect(response.body.code).toBe('INVALID_MULTIPART_BODY');
    await expectNoTemporaryFiles();
  });

  it('should reject a request without a multipart Content-Type', async () => {
    const response = await api().post('/upload').send('hello').expect(415);
    expect(response.body.code).toBe('UNSUPPORTED_CONTENT_TYPE');
    await expectNoTemporaryFiles();
  });

  it('should reject a truncated multipart body', async () => {
    const boundary = 'pizzahub-truncated-boundary';
    const invalidBody = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nPizza`,
    );
    const response = await api()
      .post('/upload')
      .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
      .send(invalidBody)
      .expect(400);
    expect(response.body.code).toBe('INVALID_MULTIPART_BODY');
    await expectNoTemporaryFiles();
  });

  it('should reject application/json', async () => {
    const response = await api()
      .post('/upload')
      .set('Content-Type', 'application/json')
      .send({ name: 'Pizza' });

    expect(response.status).toBe(415);
    expect(response.body.code).toBe('UNSUPPORTED_CONTENT_TYPE');
  });
});
