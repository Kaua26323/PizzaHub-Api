import type { ServerResponse } from 'node:http';

import { mapError } from './map-error';
import { sendJson } from '../responses/send-json';

export type ErrorHandlerOptions = {
  response: ServerResponse;
  error: unknown;
};

export function errorHandler({ response, error }: ErrorHandlerOptions): void {
  if (response.destroyed || response.writableEnded) {
    return;
  }
  if (response.headersSent) {
    response.destroy();
    return;
  }

  const mappedError = mapError(error);

  sendJson({
    response,
    statusCode: mappedError.statusCode,
    body: {
      success: false,
      data: null,
      error: mappedError.error,
    },
  });
}
