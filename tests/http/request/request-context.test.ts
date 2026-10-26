import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'node:http';

import {
  parseRequestUrl,
  setRequestContext,
  getRequestContext,
  RequestContextError,
  createRequestContext,
  setAuthenticatedActor,
} from '@/presentation/http/request/request-context';

describe('request context', () => {
  describe('parseRequestUrl', () => {
    it('should separate pathname and query parameters', () => {
      const parsed = parseRequestUrl('/products/123?active=true&sort=price');

      expect(parsed.pathname).toBe('/products/123');

      expect(parsed.query.get('active')).toBe('true');
      expect(parsed.query.get('sort')).toBe('price');
    });

    it('should decode query parameter values', () => {
      const parsed = parseRequestUrl('/products?name=Pepperoni+Pizza');

      expect(parsed.query.get('name')).toBe('Pepperoni Pizza');
    });

    it('should preserve repeated query parameters', () => {
      const parsed = parseRequestUrl('/orders?status=PENDING&status=READY');

      expect(parsed.query.getAll('status')).toEqual(['PENDING', 'READY']);
    });

    it('should reject invalid query encoding', () => {
      expect(() => parseRequestUrl('/products?name=%ZZ')).toThrow(RequestContextError);

      try {
        parseRequestUrl('/products?name=%ZZ');
      } catch (error) {
        expect(error).toBeInstanceOf(RequestContextError);

        expect((error as RequestContextError).code).toBe('INVALID_QUERY_PARAMETER');
      }
    });

    it('should reject invalid request URLs', () => {
      expect(() => parseRequestUrl('products/123')).toThrow(RequestContextError);
    });

    it('should reject dot path segments', () => {
      expect(() => parseRequestUrl('/products/../users')).toThrow(RequestContextError);
    });
  });

  describe('createRequestContext', () => {
    it('should extract route parameters', () => {
      const parsed = parseRequestUrl('/orders/order-123/items/item-456');

      const context = createRequestContext(parsed, '/orders/:orderId/items/:itemId');

      expect(context.params.orderId).toBe('order-123');

      expect(context.params.itemId).toBe('item-456');
    });

    it('should decode route parameters', () => {
      const parsed = parseRequestUrl('/products/pizza%20grande');

      const context = createRequestContext(parsed, '/products/:productId');

      expect(context.params.productId).toBe('pizza grande');
    });

    it('should return no params for a static route', () => {
      const parsed = parseRequestUrl('/health');

      const context = createRequestContext(parsed, '/health');

      expect(Object.keys(context.params)).toEqual([]);
    });
  });

  describe('request context storage', () => {
    it('should associate a context with a request', () => {
      const request = {} as IncomingMessage;

      const parsed = parseRequestUrl('/products/123');

      const context = createRequestContext(parsed, '/products/:productId');

      setRequestContext(request, context);

      expect(getRequestContext(request)).toBe(context);
    });

    it('should throw when context was not set', () => {
      const request = {} as IncomingMessage;

      expect(() => getRequestContext(request)).toThrow(
        'Request context has not been set.',
      );
    });

    it('should store an authenticated actor in the request context', () => {
      const request = {} as IncomingMessage;

      const parsed = parseRequestUrl('/users/me');
      const context = createRequestContext(parsed, '/users/me');

      setRequestContext(request, context);

      const actor = {
        id: 'user-123',
        role: 'ADMIN' as const,
      };

      setAuthenticatedActor(request, actor);

      expect(getRequestContext(request).actor).toEqual(actor);
    });

    it('should throw when setting an actor without an initialized request context', () => {
      const request = {} as IncomingMessage;

      const actor = {
        id: 'user-123',
        role: 'ADMIN' as const,
      };

      expect(() => setAuthenticatedActor(request, actor)).toThrow(
        'Request context has not been set.',
      );
    });
  });
});
