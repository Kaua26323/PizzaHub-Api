import type { ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from '@/presentation/http/errors/error-handler';
import { ResourceNotFoundError } from '@/application/errors/resource-not-found-error';

function createResponseMock(
  overrides: Partial<{
    destroyed: boolean;
    writableEnded: boolean;
    headersSent: boolean;
  }> = {},
) {
  const response = {
    destroyed: false,
    writableEnded: false,
    headersSent: false,
    statusCode: 200,
    setHeader: vi.fn(),
    end: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };

  return response;
}

describe('errorHandler', () => {
  it('should send the mapped HTTP error response', () => {
    const response = createResponseMock();

    errorHandler({
      response: response as unknown as ServerResponse,
      error: new ResourceNotFoundError('PRODUCT_NOT_FOUND', 'Product was not found.'),
    });

    expect(response.statusCode).toBe(404);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json; charset=utf-8',
    );

    expect(JSON.parse(response.end.mock.calls[0]![0])).toEqual({
      success: false,
      data: null,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product was not found.',
      },
    });
  });

  it.each([
    ['destroyed', { destroyed: true }],
    ['ended', { writableEnded: true }],
  ])('should not write when the response is %s', (_state, overrides) => {
    const response = createResponseMock(overrides);

    errorHandler({
      response: response as unknown as ServerResponse,
      error: new Error('Unexpected failure'),
    });

    expect(response.setHeader).not.toHaveBeenCalled();
    expect(response.end).not.toHaveBeenCalled();
    expect(response.destroy).not.toHaveBeenCalled();
  });

  it('should destroy the response when headers have already been sent', () => {
    const response = createResponseMock({
      headersSent: true,
    });

    errorHandler({
      response: response as unknown as ServerResponse,
      error: new Error('Stream failure'),
    });

    expect(response.destroy).toHaveBeenCalledOnce();
    expect(response.end).not.toHaveBeenCalled();
    expect(response.setHeader).not.toHaveBeenCalled();
  });
});
