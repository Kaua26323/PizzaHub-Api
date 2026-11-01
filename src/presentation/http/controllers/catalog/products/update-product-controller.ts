import { basename } from 'node:path';
import { rm } from 'node:fs/promises';
import { sendNoContent } from '@/presentation/http/responses/send-no-content';
import { getRequestContext } from '@/presentation/http/request/request-context';
import { busboyMultipartParser } from '@/presentation/http/parsers/busboy-multipart-parse';

import { ValidationError } from '@/application/errors/validation-error';
import { AuthenticationError } from '@/application/errors/authentication-error';

import type { ProductMultipartOptions } from './product-multipart-options';
import type { UpdateProductUseCase } from '@/application/use-cases/catalog/update-product';
import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

import {
  updateProductSchema,
  productIdParamsSchema,
} from '@/presentation/http/validation/catalog/product-schemas';

class UpdateProductController {
  constructor(
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly multipartOptions: ProductMultipartOptions,
  ) {}

  handler: HttpRequestHandler = async (request, response) => {
    const { actor, params } = getRequestContext(request);

    if (!actor) {
      throw new AuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'Authentication required.',
      );
    }

    const { productId } = productIdParamsSchema.parse(params);

    const { fields, image } = await busboyMultipartParser({
      request,
      ...this.multipartOptions,
      maxFields: 4,
      requireImage: false,
    });

    try {
      const parsed = updateProductSchema.parse(fields);

      if (Object.keys(parsed).length === 0 && !image) {
        throw new ValidationError(
          'VALIDATION_ERROR',
          'At least one product change is required.',
        );
      }

      const changes = {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.description !== undefined && { description: parsed.description }),
        ...(parsed.price !== undefined && { price: parsed.price }),
        ...(parsed.categoryId !== undefined && { categoryId: parsed.categoryId }),
      };

      await this.updateProductUseCase.execute({
        actor,
        productId,
        changes,
        ...(image && {
          image: {
            key: basename(image.temporaryPath),
            mimeType: image.mimeType,
            size: image.size,
          },
        }),
      });
    } finally {
      // Clean up the temporary upload if it still exists.
      // On success, ImageStorage.finalize() has already moved it.
      if (image) {
        await rm(image.temporaryPath, { force: true });
      }
    }

    sendNoContent(response);
  };
}

export { UpdateProductController };
