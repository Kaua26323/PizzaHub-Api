import type { ImageMimeTypeProps } from '@/domain/entities/product';

export type ProductResponseDTO = {
  id: string;
  name: string;
  description: string;
  price: string;
  categoryId: string;
  isActive: boolean;
  imageUrl: string;
  imageSize: number;
  imageMimeType: ImageMimeTypeProps;
  createdAt: string;
  updatedAt: string;
};
