import busboy from 'busboy';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';

import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ApiErrorCode } from '@/presentation/api-error';

type MultipartErrorCode = Extract<
  ApiErrorCode,
  | 'INVALID_MULTIPART_BODY'
  | 'UNSUPPORTED_IMAGE_TYPE'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'VALIDATION_ERROR'
  | 'FILE_TOO_LARGE'
>;

export class BusboyMultipartParserError extends Error {
  constructor(
    public readonly code: MultipartErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BusboyMultipartParserError';
  }
}

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
type ImageMimeType = (typeof allowedMimeTypes)[number];

const extensionByMimeType: Record<ImageMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export type MultipartFile = {
  temporaryPath: string;
  mimeType: ImageMimeType;
  size: number;
};

export type MultipartResult = {
  fields: Record<string, string>;
  image: MultipartFile | null;
};

export type BusboyMultipartParserOptions = {
  request: IncomingMessage;
  maxFields: number;
  maxFileSize: number;
  maxTotalBytes: number;
  temporaryFilePath: string;
  requireImage?: boolean;
};

type FileWriteResult = { success: true; image: MultipartFile } | { success: false };

type FileWriteJob = {
  controller: AbortController;
  result: Promise<FileWriteResult>;
};

function isImageMimeType(value: string): value is ImageMimeType {
  return allowedMimeTypes.some((type) => type === value);
}

// This checks only the file signature, not complete image integrity.
function matchesSignature(bytes: Buffer, mimeType: ImageMimeType): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return (
        bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      );
    case 'image/png':
      return (
        bytes.length >= 8 &&
        bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      );
    case 'image/webp':
      return (
        bytes.length >= 12 &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP'
      );
  }
}

function isMultipartContentType(contentType: string | undefined): boolean {
  if (!contentType) {
    return false;
  }

  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase();

  return mediaType === 'multipart/form-data';
}

export async function busboyMultipartParser({
  request,
  maxFields,
  maxFileSize,
  maxTotalBytes,
  temporaryFilePath,
  requireImage = true,
}: BusboyMultipartParserOptions): Promise<MultipartResult> {
  if (!isMultipartContentType(request.headers['content-type'])) {
    throw new BusboyMultipartParserError(
      'UNSUPPORTED_CONTENT_TYPE',
      'Expected multipart/form-data request.',
    );
  }

  if (
    !Number.isSafeInteger(maxFields) ||
    maxFields < 0 ||
    !Number.isSafeInteger(maxFileSize) ||
    maxFileSize <= 0 ||
    !Number.isSafeInteger(maxTotalBytes) ||
    maxTotalBytes <= 0
  ) {
    throw new BusboyMultipartParserError('VALIDATION_ERROR', 'Invalid multipart limits.');
  }

  const fields: Record<string, string> = Object.create(null);
  const fileWrites: FileWriteJob[] = [];
  const pathsToClean = new Set<string>();
  let failed: BusboyMultipartParserError | null = null;
  let fileCount = 0;
  let totalBytes = 0;

  const fail = (code: MultipartErrorCode, message: string): void => {
    failed ??= new BusboyMultipartParserError(code, message);
  };

  let bb: ReturnType<typeof busboy>;
  try {
    bb = busboy({
      headers: request.headers,
      limits: {
        files: 1,
        fields: maxFields,
        parts: maxFields + 1,
        fileSize: maxFileSize,
        fieldSize: 16 * 1024,
        fieldNameSize: 100,
        headerPairs: 100,
      },
    });
  } catch {
    throw new BusboyMultipartParserError(
      'INVALID_MULTIPART_BODY',
      'Invalid multipart request.',
    );
  }

  bb.on('field', (name, value, info) => {
    if (info.nameTruncated || info.valueTruncated) {
      fail('VALIDATION_ERROR', 'Multipart field is too large.');
      return;
    }
    if (Object.hasOwn(fields, name)) {
      fail('VALIDATION_ERROR', 'Duplicate multipart field.');
      return;
    }
    fields[name] = value;
  });

  bb.on('file', (name, stream, info) => {
    fileCount++;
    if (name !== 'image') {
      fail('VALIDATION_ERROR', 'Unexpected file field.');
      stream.resume();
      return;
    }
    if (!isImageMimeType(info.mimeType)) {
      fail('UNSUPPORTED_IMAGE_TYPE', 'Unsupported image type.');
      stream.resume();
      return;
    }

    const mimeType = info.mimeType;
    const temporaryPath = path.join(
      temporaryFilePath,
      `${randomUUID()}${extensionByMimeType[mimeType]}`,
    );
    pathsToClean.add(temporaryPath);

    let size = 0;
    let signature = Buffer.alloc(0);
    const inspector = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

        size += bytes.length;

        if (signature.length < 12) {
          const remaining = 12 - signature.length;
          signature = Buffer.concat([signature, bytes.subarray(0, remaining)]);
        }
        callback(null, bytes);
      },
    });

    stream.on('limit', () => {
      fail('FILE_TOO_LARGE', 'Image exceeds the maximum file size.');
    });

    const controller = new AbortController();
    const result: Promise<FileWriteResult> = pipeline(
      stream,
      inspector,
      createWriteStream(temporaryPath, { flags: 'wx' }),
      { signal: controller.signal },
    ).then(
      () => {
        if (stream.truncated) {
          fail('FILE_TOO_LARGE', 'Image exceeds the maximum file size.');
        }
        if (size === 0 || !matchesSignature(signature, mimeType)) {
          fail('UNSUPPORTED_IMAGE_TYPE', 'Image signature does not match its MIME type.');
        }
        return { success: true, image: { temporaryPath, mimeType, size } } as const;
      },
      (error: unknown) => {
        // Abort is expected if the HTTP request fails first.
        if (!controller.signal.aborted) {
          fail('INVALID_MULTIPART_BODY', 'Failed to write the uploaded image.');
          bb.destroy(error instanceof Error ? error : new Error('File write failed.'));
        }
        return { success: false } as const;
      },
    );

    fileWrites.push({ controller, result });
  });

  bb.on('filesLimit', () => fail('INVALID_MULTIPART_BODY', 'Too many files.'));
  bb.on('fieldsLimit', () => fail('INVALID_MULTIPART_BODY', 'Too many fields.'));
  bb.on('partsLimit', () => fail('INVALID_MULTIPART_BODY', 'Too many multipart parts.'));

  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      totalBytes += chunk.length;

      if (totalBytes > maxTotalBytes) {
        callback(
          new BusboyMultipartParserError(
            'FILE_TOO_LARGE',
            'Multipart body exceeds the total size limit.',
          ),
        );
        return;
      }

      callback(null, chunk);
    },
  });

  await mkdir(temporaryFilePath, { recursive: true });

  let uploadSucceeded = false;
  try {
    let requestError: unknown;
    try {
      await pipeline(request, limiter, bb);
    } catch (error) {
      requestError = error;
      // On a failed HTTP/parser pipeline, file pipelines may otherwise
      // remain pending. Abort them before awaiting their settlement.
      for (const job of fileWrites) {
        job.controller.abort();
      }
    }

    // All promises handle their own rejection and produce a result.
    // Awaiting them ensures write handles are closed before cleanup.
    const finishedFiles = await Promise.all(fileWrites.map((job) => job.result));
    const firstFile = finishedFiles[0];
    const image = firstFile?.success ? firstFile.image : null;

    if (requestError instanceof BusboyMultipartParserError) {
      throw requestError;
    }

    if (failed) {
      throw failed;
    }

    if (requestError !== undefined) {
      throw new BusboyMultipartParserError(
        'INVALID_MULTIPART_BODY',
        'Malformed or interrupted multipart request.',
      );
    }

    if (fileCount === 0) {
      if (requireImage) {
        throw new BusboyMultipartParserError('VALIDATION_ERROR', 'An image is required.');
      }

      uploadSucceeded = true;
      return { fields, image: null };
    }

    if (!image) {
      throw new BusboyMultipartParserError(
        'INVALID_MULTIPART_BODY',
        'Image was not processed.',
      );
    }

    // Ownership of the validated temporary file passes to the caller.
    pathsToClean.delete(image.temporaryPath);
    uploadSucceeded = true;
    return { fields, image };
  } finally {
    // Do not erase a successfully returned temporary image.
    // All writing jobs are settled before we reach this cleanup block.
    if (!uploadSucceeded) {
      for (const job of fileWrites) {
        job.controller.abort();
      }
      await Promise.all(fileWrites.map((job) => job.result));
    }
    for (const candidate of pathsToClean) {
      await rm(candidate, { force: true });
    }
  }
}
