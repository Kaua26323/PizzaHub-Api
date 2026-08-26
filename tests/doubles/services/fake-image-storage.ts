import type {
  ImageStorage,
  StoredImage,
  TemporaryImage,
} from '@/application/services/image-storage';

class FakeImageStorage implements ImageStorage {
  public readonly finalizedImages: TemporaryImage[] = [];
  public readonly storedImages: StoredImage[] = [];
  public readonly deletedKeys: string[] = [];

  async finalize(image: TemporaryImage): Promise<StoredImage> {
    const temporaryImage = { ...image };
    const storedImage = {
      ...temporaryImage,
      key: `stored/${temporaryImage.key}`,
    };

    this.finalizedImages.push(temporaryImage);
    this.storedImages.push(storedImage);

    return { ...storedImage };
  }

  async delete(key: string): Promise<void> {
    this.deletedKeys.push(key);

    const index = this.storedImages.findIndex((image) => image.key === key);

    if (index !== -1) {
      this.storedImages.splice(index, 1);
    }
  }
}

export { FakeImageStorage };
