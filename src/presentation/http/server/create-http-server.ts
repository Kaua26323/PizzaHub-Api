import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

type HttpRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void | Promise<void>;

function createHttpServer(handler: HttpRequestHandler): Server {
  return createServer(handler);
}

export { createHttpServer };
export type { HttpRequestHandler };
