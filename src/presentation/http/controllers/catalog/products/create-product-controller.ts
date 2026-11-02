import { basename } from 'node:path';
import { rm } from 'node:fs/promises';
import { sendJson } from '@/presentation/http/responses/send-json';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { busboyMultipartParser } from '@/presentation/http/parsers/busboy-multipart-parse';
import { createProductSchema } from '@/presentation/http/validation/catalog/product-schemas';

import { ValidationError } from '@/application/errors/validation-error';
import { AuthenticationError } from '@/application/errors/authentication-error';

import type { ProductMultipartOptions } from './product-multipart-options';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';
import type { CreateProductUseCase } from '@/application/use-cases/catalog/create-product';

class CreateProductController {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly multipartOptions: ProductMultipartOptions,
  ) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const { fields, image } = await busboyMultipartParser({
      request,
      ...this.multipartOptions,
      maxFields: 5,
      requireImage: false,
    });

    try {
      const product = createProductSchema.parse(fields);

      if (!image) {
        throw new ValidationError(
          'PRODUCT_IMAGE_REQUIRED',
          'A product image is required.',
        );
      }

      await this.createProductUseCase.execute({
        actor,
        product,
        image: {
          key: basename(image.temporaryPath),
          mimeType: image.mimeType,
          size: image.size,
        },
      });
    } finally {
      // Clean up the temporary upload if it still exists.
      // On success, ImageStorage.finalize() has already moved it.
      if (image) {
        await rm(image.temporaryPath, { force: true });
      }
    }

    sendJson({
      response,
      statusCode: 201,
      body: { success: true, data: null, error: null },
    });
  };
}

export { CreateProductController };
