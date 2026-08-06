import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEnv } from '@/infrastructure/config/env-schema';

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  PORT: '3000',

  WEB_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pizzahub_test',

  JWT_ISSUER: 'pizzahub_api',
  JWT_AUDIENCE: 'pizzahub_web',
  JWT_ACCESS_SECRET: 'a'.repeat(32),

  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_SECONDS: '604800',

  MAX_UPLOAD_SIZE: '5242880',
  UPLOAD_DIRECTORY: 'uploads/products',
  UPLOAD_TEMP_DIRECTORY: 'uploads/tmp/products',
};

afterEach(() => {
  vi.resetAllMocks();
});

describe('Environments (Unit)', () => {
  it('should parse a valid environment', () => {
    const result = parseEnv(validEnv);
    expect(result).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,

      WEB_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pizzahub_test',

      JWT_ISSUER: 'pizzahub_api',
      JWT_AUDIENCE: 'pizzahub_web',
      JWT_ACCESS_SECRET: 'a'.repeat(32),

      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_SECONDS: 604800,

      MAX_UPLOAD_SIZE: 5_242_880,
      UPLOAD_DIRECTORY: 'uploads/products',
      UPLOAD_TEMP_DIRECTORY: 'uploads/tmp/products',
    });
  });

  it('should coerce numeric strings to numbers', () => {
    const result = parseEnv({
      ...validEnv,
      PORT: '8000',
      MAX_UPLOAD_SIZE: '2000',
      ACCESS_TOKEN_TTL_SECONDS: '1000',
      REFRESH_TOKEN_TTL_SECONDS: '5000',
    });

    expect(result.PORT).toBe(8000);
    expect(result.MAX_UPLOAD_SIZE).toBe(2000);
    expect(result.ACCESS_TOKEN_TTL_SECONDS).toBe(1000);
    expect(result.REFRESH_TOKEN_TTL_SECONDS).toBe(5000);
  });

  it('should apply default values', () => {
    const result = parseEnv({
      ...validEnv,
      PORT: undefined,
      MAX_UPLOAD_SIZE: undefined,
      UPLOAD_DIRECTORY: undefined,
      UPLOAD_TEMP_DIRECTORY: undefined,
      ACCESS_TOKEN_TTL_SECONDS: undefined,
      REFRESH_TOKEN_TTL_SECONDS: undefined,
    });

    expect(result.PORT).toBe(3000);
    expect(result.MAX_UPLOAD_SIZE).toBe(5_242_880);
    expect(result.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(result.REFRESH_TOKEN_TTL_SECONDS).toBe(604800);
    expect(result.UPLOAD_DIRECTORY).toBe('uploads/products');
    expect(result.UPLOAD_TEMP_DIRECTORY).toBe('uploads/tmp/products');
  });

  it('should trim string values', () => {
    const result = parseEnv({
      ...validEnv,
      UPLOAD_DIRECTORY: ' uploads/products ',
      UPLOAD_TEMP_DIRECTORY: ' uploads/tmp/products ',
      JWT_ISSUER: ' pizzahub_api ',
      JWT_AUDIENCE: ' pizzahub_web ',
    });

    expect(result.JWT_ISSUER).toBe('pizzahub_api');
    expect(result.JWT_AUDIENCE).toBe('pizzahub_web');
    expect(result.UPLOAD_DIRECTORY).toBe('uploads/products');
    expect(result.UPLOAD_TEMP_DIRECTORY).toBe('uploads/tmp/products');
  });

  it.each([
    {
      description: 'NODE_ENV is invalid',
      override: {
        NODE_ENV: 'staging',
      },
    },
    {
      description: 'PORT is smaller than 1',
      override: {
        PORT: '0',
      },
    },
    {
      description: 'PORT is greater than 65535',
      override: {
        PORT: '65536',
      },
    },
    {
      description: 'WEB_ORIGIN uses an invalid protocol',
      override: {
        WEB_ORIGIN: 'ftp://localhost:5173',
      },
    },
    {
      description: 'DATABASE_URL uses a non-PostgreSQL protocol',
      override: {
        DATABASE_URL: 'mysql://root:password@localhost/database',
      },
    },
    {
      description: 'JWT_ISSUER is blank',
      override: {
        JWT_ISSUER: '   ',
      },
    },
    {
      description: 'JWT_AUDIENCE is blank',
      override: {
        JWT_AUDIENCE: '   ',
      },
    },
    {
      description: 'access-token TTL is zero',
      override: {
        ACCESS_TOKEN_TTL_SECONDS: '0',
      },
    },
    {
      description: 'refresh-token TTL is negative',
      override: {
        REFRESH_TOKEN_TTL_SECONDS: '-1',
      },
    },
    {
      description: 'JWT secret is too short',
      override: {
        JWT_ACCESS_SECRET: 'a'.repeat(31),
      },
    },
    {
      description: 'upload directory is blank',
      override: {
        UPLOAD_DIRECTORY: '   ',
      },
    },
    {
      description: 'maximum upload size is exceeded',
      override: {
        MAX_UPLOAD_SIZE: String(5_242_881),
      },
    },
  ])('should throw an error when $description', ({ override }) => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() =>
      parseEnv({
        ...validEnv,
        ...override,
      }),
    ).toThrow('Invalid environment configuration');

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });
});
