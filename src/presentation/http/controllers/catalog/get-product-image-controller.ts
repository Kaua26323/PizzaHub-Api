import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { sendJson } from '../../responses/send-json';
import type { HttpRequestHandler } from '../../server/create-http-server';
import { getRequestContext } from '@/presentation/http/request/request-context';

class GetProductImageController {
  constructor(private readonly permanentDirectory: string) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { params } = getRequestContext(request);

    const imageKey = params.imageKey;

    if (!imageKey || !this.isValidKey(imageKey)) {
      sendJson({
        response,
        statusCode: 400,
        body: {
          success: false,
          data: null,
          error: {
            code: 'INVALID_ROUTE_PARAMETER',
            message: 'Invalid image key.',
          },
        },
      });

      return;
    }

    const imagePath = join(this.permanentDirectory, imageKey);

    let fileHandle;

    try {
      fileHandle = await open(imagePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      if (this.isFileNotFound(error)) {
        sendJson({
          response,
          statusCode: 404,
          body: {
            success: false,
            data: null,
            error: {
              code: 'IMAGE_NOT_FOUND',
              message: 'Product image not found.',
            },
          },
        });

        return;
      }

      throw error;
    }

    try {
      const imageInfo = await fileHandle.stat();

      if (!imageInfo.isFile()) {
        throw new Error('Image path is not a regular file.');
      }

      const contentType = this.getContentType(imageKey);

      response.statusCode = 200;
      response.setHeader('Content-Type', contentType);
      response.setHeader('Content-Length', imageInfo.size);

      await pipeline(fileHandle.createReadStream(), response);
    } finally {
      await fileHandle.close();
    }
  };

  private isValidKey(key: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$/.test(
      key,
    );
  }

  private getContentType(key: string): string {
    switch (extname(key).toLowerCase()) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';

      default:
        throw new Error('Unsupported image format');
    }
  }

  private isFileNotFound(error: unknown): boolean {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT';
  }
}

export { GetProductImageController };
