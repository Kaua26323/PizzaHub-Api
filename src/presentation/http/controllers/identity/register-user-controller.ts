import { sendJson } from '../../responses/send-json';
import { registerSchema } from '@/presentation/http/validation/identity/register-schema';

import { jsonBodyParser } from '@/presentation/http/parsers/json-body-parser';
import type { JsonBodyParserOptions } from '@/presentation/http/parsers/json-body-parser';

import type { HttpRequestHandler } from '@/presentation/http/server/create-http-server';

import type { UserResponseDTO } from '../dtos/identity/user-response-dto';
import type { RegisterUserUseCase } from '@/application/use-cases/identity/register-user';

export type RegisterUserResponseDTO = UserResponseDTO;

class RegisterUserController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly jsonBodyParserOptions: Omit<JsonBodyParserOptions, 'request'>,
  ) {}

  handler: HttpRequestHandler = async (request, response) => {
    const body = await jsonBodyParser({
      request,
      ...this.jsonBodyParserOptions,
    });

    const validatedData = registerSchema.parse(body);

    const newUser = await this.registerUserUseCase.execute({
      name: validatedData.name,
      email: validatedData.email,
      password: validatedData.password,
    });

    sendJson<RegisterUserResponseDTO>({
      response,
      statusCode: 201,
      body: {
        success: true,
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          createdAt: newUser.createdAt,
          updatedAt: newUser.updatedAt,
        },
        error: null,
      },
    });
  };
}

export { RegisterUserController };
