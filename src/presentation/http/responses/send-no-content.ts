import type { ServerResponse } from 'node:http';

export function sendNoContent(response: ServerResponse) {
  response.statusCode = 204;
  response.end();
}
