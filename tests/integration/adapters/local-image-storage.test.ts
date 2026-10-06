import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalImageStorage } from '@/infrastructure/storage/local-image-storage';

describe('LocalImageStorage', () => {
  let rootDirectory: string;
  let temporaryDirectory: string;
  let permanentDirectory: string;

  let sut: LocalImageStorage;

  beforeEach(async () => {
    rootDirectory = join(tmpdir(), `pizzahub-local-image-storage-${randomUUID()}`);

    temporaryDirectory = join(rootDirectory, 'uploads', '.tmp', 'products');

    permanentDirectory = join(rootDirectory, 'uploads', 'products');

    await mkdir(temporaryDirectory, {
      recursive: true,
    });

    sut = new LocalImageStorage({
      temporaryDirectory,
      permanentDirectory,
    });
  });

  afterEach(async () => {
    await rm(rootDirectory, {
      recursive: true,
      force: true,
    });
  });

  it('should move a temporary image to permanent storage', async () => {
    const temporaryKey = 'temporary-image.webp';
    const temporaryPath = join(temporaryDirectory, temporaryKey);

    const content = Buffer.from('fake-image-content');

    await writeFile(temporaryPath, content);

    const storedImage = await sut.finalize({
      key: temporaryKey,
      mimeType: 'image/webp',
      size: content.length,
    });

    const permanentPath = join(permanentDirectory, storedImage.key);

    await expect(access(temporaryPath)).rejects.toThrow();
    await expect(access(permanentPath)).resolves.toBeUndefined();

    const storedContent = await readFile(permanentPath);

    expect(storedContent).toEqual(content);
  });

  it('should generate a server-controlled permanent key', async () => {
    const temporaryKey = 'temporary-image.png';
    const content = Buffer.from('fake-image-content');

    await writeFile(join(temporaryDirectory, temporaryKey), content);

    const storedImage = await sut.finalize({
      key: temporaryKey,
      mimeType: 'image/png',
      size: content.length,
    });

    expect(storedImage.key).not.toBe(temporaryKey);
    expect(storedImage.key).toMatch(/\.png$/);
  });

  it('should derive the permanent extension from the validated MIME type', async () => {
    const temporaryKey = 'temporary-file.fake';
    const content = Buffer.from('fake-image-content');

    await writeFile(join(temporaryDirectory, temporaryKey), content);

    const storedImage = await sut.finalize({
      key: temporaryKey,
      mimeType: 'image/jpeg',
      size: content.length,
    });

    expect(storedImage.key).toMatch(/\.jpg$/);
  });

  it.each([
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/webp', '.webp'],
  ] as const)('should use %s images with %s extension', async (mimeType, extension) => {
    const temporaryKey = `temporary-${randomUUID()}`;
    const content = Buffer.from('fake-image-content');

    await writeFile(join(temporaryDirectory, temporaryKey), content);

    const storedImage = await sut.finalize({
      key: temporaryKey,
      mimeType,
      size: content.length,
    });

    expect(storedImage.key).toMatch(new RegExp(`${extension.replace('.', '\\.')}$`));
  });

  it('should return only the stored image metadata', async () => {
    const temporaryKey = 'temporary-image.webp';
    const content = Buffer.from('fake-image-content');

    await writeFile(join(temporaryDirectory, temporaryKey), content);

    const storedImage = await sut.finalize({
      key: temporaryKey,
      mimeType: 'image/webp',
      size: content.length,
    });

    expect(storedImage).toEqual({
      key: expect.any(String),
      mimeType: 'image/webp',
      size: content.length,
    });
  });

  it('should reject an unsafe temporary image key', async () => {
    await expect(
      sut.finalize({
        key: '../outside.webp',
        mimeType: 'image/webp',
        size: 100,
      }),
    ).rejects.toThrow('Invalid image key.');
  });

  it('should delete a temporary image', async () => {
    const key = 'temporary-image.webp';
    const path = join(temporaryDirectory, key);

    await writeFile(path, Buffer.from('fake-image-content'));

    await sut.delete(key);

    await expect(access(path)).rejects.toThrow();
  });

  it('should delete a permanent image', async () => {
    await mkdir(permanentDirectory, {
      recursive: true,
    });

    const key = 'stored-image.webp';
    const path = join(permanentDirectory, key);

    await writeFile(path, Buffer.from('fake-image-content'));

    await sut.delete(key);

    await expect(access(path)).rejects.toThrow();
  });

  it('should not fail when deleting an image that does not exist', async () => {
    await expect(sut.delete('missing-image.webp')).resolves.toBeUndefined();
  });

  it('should reject unsafe image keys', async () => {
    await expect(sut.delete('../outside.webp')).rejects.toThrow('Invalid image key.');
  });
});
