import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { mkdir, rename, unlink } from 'node:fs/promises';

import type {
  StoredImage,
  ImageStorage,
  TemporaryImage,
} from '@/application/services/image-storage';

type LocalImageStorageConfig = {
  temporaryDirectory: string;
  permanentDirectory: string;
};

const extensionByMimeType = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
} as const;

class LocalImageStorage implements ImageStorage {
  constructor(private readonly config: LocalImageStorageConfig) {}

  async finalize(image: TemporaryImage): Promise<StoredImage> {
    await this.ensureDirectories();

    const temporaryKey = this.validateKey(image.key);

    const extension = extensionByMimeType[image.mimeType];

    const storedKey = `${randomUUID()}${extension}`;

    const temporaryPath = join(this.config.temporaryDirectory, temporaryKey);

    const permanentPath = join(this.config.permanentDirectory, storedKey);

    await rename(temporaryPath, permanentPath);

    return {
      key: storedKey,
      mimeType: image.mimeType,
      size: image.size,
    };
  }

  async delete(key: string): Promise<void> {
    const safeKey = this.validateKey(key);

    const temporaryPath = join(this.config.temporaryDirectory, safeKey);

    const permanentPath = join(this.config.permanentDirectory, safeKey);

    await this.deleteIfExists(temporaryPath);
    await this.deleteIfExists(permanentPath);
  }

  private async ensureDirectories(): Promise<void> {
    await Promise.all([
      mkdir(this.config.temporaryDirectory, {
        recursive: true,
      }),

      mkdir(this.config.permanentDirectory, {
        recursive: true,
      }),
    ]);
  }

  private validateKey(key: string): string {
    if (basename(key) !== key || key === '.' || key === '..') {
      throw new Error('Invalid image key.');
    }

    return key;
  }

  private async deleteIfExists(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return;
      }

      throw error;
    }
  }
}

export { LocalImageStorage };
