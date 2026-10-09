import { Writable } from 'node:stream';
import readline from 'node:readline/promises';

import { ApplicationError } from '@/application/errors/application-error';
import { BootstrapAdminUseCase } from '@/application/use-cases/identity/bootstrap-admin';

import { SystemClock } from '@/infrastructure/time/system-clock';
import { pool } from '@/infrastructure/database/postgres/connection/pool';
import { NodeIdGenerator } from '@/infrastructure/identifiers/node-id-generator';
import { BcryptPasswordHasher } from '@/infrastructure/cryptography/bcrypt-password-hasher';
import { PostgresUsersRepository } from '@/infrastructure/database/postgres/repositories/postgres-users-repository';

const systemClock = new SystemClock();
const idGenerator = new NodeIdGenerator();
const passwordHasher = new BcryptPasswordHasher(12);
const usersRepository = new PostgresUsersRepository(pool);

const bootstrapAdmin = new BootstrapAdminUseCase(
  usersRepository,
  systemClock,
  idGenerator,
  passwordHasher,
);

let muteOutput = false;

const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muteOutput) {
      process.stdout.write(chunk);
    }

    callback();
  },
});

const rl = readline.createInterface({
  input: process.stdin,
  output,
  terminal: true,
});

async function readPassword(prompt: string): Promise<string> {
  process.stdout.write(prompt);

  muteOutput = true;

  try {
    return await rl.question('');
  } finally {
    muteOutput = false;
    process.stdout.write('\n');
  }
}

try {
  console.log('=== Create administrator ===');

  const name = await rl.question('Name: ');
  const email = await rl.question('Email: ');
  const password = await readPassword('Password: ');

  console.log('Creating administrator...');

  await bootstrapAdmin.execute({
    name: name.trim(),
    email: email.trim(),
    password,
  });

  console.log('Administrator created successfully.');
  process.exitCode = 0;
} catch (err) {
  if (err instanceof ApplicationError) {
    console.log(err.message);
  } else {
    console.log('Failed to create administrator.');
  }

  process.exitCode = 1;
} finally {
  rl.close();
  await pool.end();
}
