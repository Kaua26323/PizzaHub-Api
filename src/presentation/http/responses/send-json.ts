import type { ServerResponse } from 'http';
import type { ApiResponse } from './api-response';

export type SendJsonOptions<T> = {
  response: ServerResponse;
  statusCode: number;
  body: ApiResponse<T>;
};

export function sendJson<T>({ response, statusCode, body }: SendJsonOptions<T>) {
  response.statusCode = statusCode;

  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  response.end(JSON.stringify(body));
}
