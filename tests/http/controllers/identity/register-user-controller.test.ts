import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { controllerTestServer } from './controller-test-server';
import { ConflictError } from '@/application/errors/conflict-error';
import { RegisterUserController } from '@/presentation/http/controllers/identity/register-user-controller';

import type { RegisterUserUseCase } from '@/application/use-cases/identity/register-user';

const createdAt = new Date('2026-01-02T03:04:05.000Z');
const updatedAt = new Date('2026-01-03T03:04:05.000Z');
const validBody = {
  name: '  Ana Silva  ',
  email: '  ANA@EXAMPLE.COM  ',
  password: 'Secret123!',
};

function makeServer() {
  const execute = vi.fn(async () => ({
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Ana Silva',
    email: 'ana@example.com',
    role: 'STAFF' as const,
    createdAt,
    updatedAt,
    passwordHash: 'private-hash',
  }));

  const controller = new RegisterUserController(
    { execute } as unknown as RegisterUserUseCase,
    { maxBytes: 1024, allowEmpty: false },
  );

  return {
    execute,
    server: controllerTestServer('post', '/users', controller.handler),
  };
}

describe('RegisterUserController', () => {
  it('should register a user with normalized input and return only public information with HTTP 201', async () => {
    const { server, execute } = makeServer();

    const response = await request(server).post('/users').send(validBody).expect(201);

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      name: 'Ana Silva',
      email: 'ana@example.com',
      password: 'Secret123!',
    });

    expect(response.body).toEqual({
      success: true,
      data: {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Ana Silva',
        email: 'ana@example.com',
        role: 'STAFF',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
      error: null,
    });

    expect(response.text).not.toContain('Secret123!');
    expect(response.text).not.toContain('private-hash');
  });

  it.each([
    [{ ...validBody, password: 'short' }, 'password'],
    [{ ...validBody, unexpected: true }, ''],
  ])(
    'should reject invalid or unexpected registration fields without calling the use case',
    async (body, path) => {
      const { server, execute } = makeServer();

      const response = await request(server).post('/users').send(body).expect(400);

      expect(response.body).toMatchObject({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.' },
      });

      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path })]),
      );

      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('should map application errors through centralized HTTP handling', async () => {
    const { server, execute } = makeServer();
    execute.mockRejectedValueOnce(
      new ConflictError('EMAIL_ALREADY_EXISTS', 'Email already exists.'),
    );

    const response = await request(server).post('/users').send(validBody).expect(409);

    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email already exists.' },
    });
  });
});
