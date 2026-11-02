import { describe, expect, it } from 'vitest';
import {
  createRequest,
  database,
  expectError,
  expectNoTemporaryFiles,
  png,
  jpeg,
  seedCategory,
  storedNames,
} from '../helpers/product-api';

async function expectNoUploadArtifacts() {
  expect((await database().query('SELECT id FROM products')).rowCount).toBe(0);
  expect(await storedNames()).toEqual([]);
  await expectNoTemporaryFiles();
}

function pngWithValidTextChunk(totalSize: number): Buffer {
  const data = Buffer.alloc(totalSize - png.length - 12, 0x78);
  Buffer.from('Comment\0').copy(data);
  const type = Buffer.from('tEXt');
  let crc = 0xffffffff;

  for (const byte of Buffer.concat([type, data])) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }

  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]);
}

describe('product multipart upload validation', () => {
  it('should accept a JPEG image through the complete create route', async () => {
    await seedCategory();
    const response = await createRequest()
      .attach('image', jpeg, { filename: 'pizza.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(response.body).toEqual({ success: true, data: null, error: null });
    const result = await database().query(
      'SELECT image_mime_type, image_size FROM products',
    );
    expect(result.rows[0]).toMatchObject({
      image_mime_type: 'image/jpeg',
      image_size: jpeg.length,
    });
    await expectNoTemporaryFiles();
  });

  it('should reject an unsupported declared MIME type', async () => {
    await seedCategory();
    const response = await createRequest()
      .attach('image', png, { filename: 'pizza.gif', contentType: 'image/gif' })
      .expect(415);
    expectError(response, 'UNSUPPORTED_IMAGE_TYPE');
    await expectNoUploadArtifacts();
  });

  it('should reject bytes whose signature does not match the declared MIME type', async () => {
    await seedCategory();
    const response = await createRequest()
      .attach('image', png, { filename: 'pizza.jpg', contentType: 'image/jpeg' })
      .expect(415);
    expectError(response, 'UNSUPPORTED_IMAGE_TYPE');
    await expectNoUploadArtifacts();
  });

  it('should reject an image over the five MiB limit', async () => {
    await seedCategory();
    const oversized = Buffer.concat([
      png,
      Buffer.alloc(5 * 1024 * 1024 + 1 - png.length),
    ]);
    const response = await createRequest()
      .attach('image', oversized, 'large.png')
      .timeout({ response: 5000, deadline: 10000 })
      .expect(413);
    expectError(response, 'FILE_TOO_LARGE');
    await expectNoUploadArtifacts();
  });

  it.each([5 * 1024 * 1024 - 1, 5 * 1024 * 1024])(
    'should accept a valid PNG of %i bytes',
    async (size) => {
      await seedCategory();
      const boundaryImage = pngWithValidTextChunk(size);
      const response = await createRequest()
        .attach('image', boundaryImage, 'boundary.png')
        .timeout({ response: 5000, deadline: 10000 })
        .expect(201);
      expect(response.body).toEqual({ success: true, data: null, error: null });
      const result = await database().query('SELECT image_size FROM products');
      expect(result.rows[0].image_size).toBe(boundaryImage.length);
      await expectNoTemporaryFiles();
    },
  );

  it('should reject a sixth multipart field', async () => {
    await seedCategory();
    const response = await createRequest()
      .field('extra', 'value')
      .attach('image', png, 'pizza.png')
      .expect(400);
    expectError(response, 'INVALID_MULTIPART_BODY');
    await expectNoUploadArtifacts();
  });

  it('should reject two uploaded images', async () => {
    await seedCategory();
    const response = await createRequest()
      .attach('image', png, 'first.png')
      .attach('image', png, 'second.png')
      .expect(400);
    expectError(response, 'INVALID_MULTIPART_BODY');
    await expectNoUploadArtifacts();
  });
});
