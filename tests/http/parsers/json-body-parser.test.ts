import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import type { IncomingMessage, IncomingHttpHeaders } from 'node:http';

import { describe, expect, it } from 'vitest';

import {
  jsonBodyParser,
  JsonBodyParserError,
} from '@/presentation/http/parsers/json-body-parser';

function createRequest(
  chunks: Buffer[],
  headers: IncomingHttpHeaders = {},
): IncomingMessage {
  const request = Readable.from(chunks) as unknown as IncomingMessage;

  request.headers = headers;

  Object.defineProperty(request, 'complete', {
    value: true,
    writable: true,
  });

  return request;
}

function createAbortedRequest(): IncomingMessage {
  const request = new Readable({
    read() {
      this.destroy(new Error('Connection closed'));
    },
  }) as unknown as IncomingMessage;

  request.headers = {
    'content-type': 'application/json',
  };

  Object.defineProperty(request, 'complete', {
    value: false,
    writable: true,
  });

  return request;
}

describe('jsonBodyParser', () => {
  it('should parse a valid JSON body', async () => {
    const body = Buffer.from(
      JSON.stringify({
        name: 'Pepperoni',
        price: '45.90',
      }),
    );

    const request = createRequest([body], {
      'content-type': 'application/json',
    });

    const result = await jsonBodyParser({
      request,
      maxBytes: 1024,
      allowEmpty: false,
    });

    expect(result).toEqual({
      name: 'Pepperoni',
      price: '45.90',
    });
  });

  it('should combine multiple body chunks before parsing JSON', async () => {
    const request = createRequest(
      [
        Buffer.from('{"name":"Pep'),
        Buffer.from('peroni","price":'),
        Buffer.from('"45.90"}'),
      ],
      {
        'content-type': 'application/json',
      },
    );

    const result = await jsonBodyParser({
      request,
      maxBytes: 1024,
      allowEmpty: false,
    });

    expect(result).toEqual({
      name: 'Pepperoni',
      price: '45.90',
    });
  });

  it('should accept application/json with charset', async () => {
    const request = createRequest([Buffer.from('{"name":"Pepperoni"}')], {
      'content-type': 'application/json; charset=utf-8',
    });

    const result = await jsonBodyParser({
      request,
      maxBytes: 1024,
      allowEmpty: false,
    });

    expect(result).toEqual({
      name: 'Pepperoni',
    });
  });

  it('should reject malformed JSON', async () => {
    const request = createRequest([Buffer.from('{"name":"Pepperoni",}')], {
      'content-type': 'application/json',
    });

    const promise = jsonBodyParser({
      request,
      maxBytes: 1024,
      allowEmpty: false,
    });

    await expect(promise).rejects.toMatchObject({
      name: 'JsonBodyParserError',
      code: 'MALFORMED_JSON',
      message: 'Malformed JSON body.',
    });
  });

  it('should return undefined for an empty body when empty bodies are allowed', async () => {
    const request = createRequest([]);

    const result = await jsonBodyParser({
      request,
      maxBytes: 1024,
      allowEmpty: true,
    });

    expect(result).toBeUndefined();
  });

  it('should reject an empty body when empty bodies are not allowed', async () => {
    const request = createRequest([]);

    const promise = jsonBodyParser({
      request,
      maxBytes: 1024,
      allowEmpty: false,
    });

    await expect(promise).rejects.toMatchObject({
      name: 'JsonBodyParserError',
      code: 'VALIDATION_ERROR',
      message: 'JSON body can not be empty.',
    });
  });

  it('should reject a non-empty body with an unsupported content type', async () => {
    const request = createRequest([Buffer.from('{"name":"Pepperoni"}')], {
      'content-type': 'text/plain',
    });

    const promise = jsonBodyParser({
      request,
      maxBytes: 1024,
      allowEmpty: true,
    });

    await expect(promise).rejects.toMatchObject({
      name: 'JsonBodyParserError',
      code: 'UNSUPPORTED_CONTENT_TYPE',
      message: 'Invalid content type.',
    });
  });

  it('should reject a non-empty body without a content type', async () => {
    const request = createRequest([Buffer.from('{"name":"Pepperoni"}')]);

    const promise = jsonBodyParser({
      request,
      maxBytes: 1024,
      allowEmpty: false,
    });

    await expect(promise).rejects.toMatchObject({
      code: 'UNSUPPORTED_CONTENT_TYPE',
    });
  });

  it('should reject a body when declared content length exceeds the limit', async () => {
    const request = createRequest([], {
      'content-type': 'application/json',
      'content-length': '5000',
    });

    const promise = jsonBodyParser({
      request,
      maxBytes: 100,
      allowEmpty: false,
    });

    await expect(promise).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
      message: 'JSON body exceeds the maximum allowed size.',
    });
  });

  it('should reject when received bytes exceed the maximum size', async () => {
    const request = createRequest([Buffer.from('12345'), Buffer.from('67890')], {
      'content-type': 'application/json',
    });

    const promise = jsonBodyParser({
      request,
      maxBytes: 8,
      allowEmpty: false,
    });

    await expect(promise).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });

  it('should accept a body exactly at the maximum size', async () => {
    const body = Buffer.from('{"a":1}');

    const request = createRequest([body], {
      'content-type': 'application/json',
    });

    const result = await jsonBodyParser({
      request,
      maxBytes: body.length,
      allowEmpty: false,
    });

    expect(result).toEqual({
      a: 1,
    });
  });
  it('should handle an aborted request', async () => {
    const request = createAbortedRequest();

    const promise = jsonBodyParser({
      request,
      maxBytes: 1024,
      allowEmpty: false,
    });

    await expect(promise).rejects.toMatchObject({
      name: 'JsonBodyParserError',
      code: 'VALIDATION_ERROR',
      message: 'Request was aborted',
    });
  });
});
