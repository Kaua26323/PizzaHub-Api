import type { ImageMimeTypeProps } from '@/domain/entities/product';

export type TemporaryImage = {
  key: string;
  mimeType: ImageMimeTypeProps;
  size: number;
};

export type StoredImage = {
  key: string;
  mimeType: ImageMimeTypeProps;
  size: number;
};

export type ImageStorage = {
  finalize(image: TemporaryImage): Promise<StoredImage>;
  delete(key: string): Promise<void>;
};
