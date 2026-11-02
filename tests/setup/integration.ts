import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';

import { afterAll, beforeEach } from 'vitest';

const previousUploadDirectory = process.env.UPLOAD_DIRECTORY;
const previousTemporaryDirectory = process.env.UPLOAD_TEMP_DIRECTORY;

const uploadRoot = await mkdtemp(join(tmpdir(), 'pizzahub-integration-'));

const permanentDirectory = join(uploadRoot, 'stored');
const temporaryDirectory = join(uploadRoot, 'temporary');

// The app freezes its environment on first import, so configure isolated
// uploads before the PostgreSQL setup or application modules load it.
process.env.UPLOAD_DIRECTORY = permanentDirectory;
process.env.UPLOAD_TEMP_DIRECTORY = temporaryDirectory;

await import('./postgres');

beforeEach(async () => {
  await Promise.all([
    rm(permanentDirectory, { recursive: true, force: true }),
    rm(temporaryDirectory, { recursive: true, force: true }),
  ]);
  await Promise.all([mkdir(permanentDirectory), mkdir(temporaryDirectory)]);
});

afterAll(async () => {
  await rm(uploadRoot, { recursive: true, force: true });
  if (previousUploadDirectory === undefined) delete process.env.UPLOAD_DIRECTORY;
  else process.env.UPLOAD_DIRECTORY = previousUploadDirectory;
  if (previousTemporaryDirectory === undefined) delete process.env.UPLOAD_TEMP_DIRECTORY;
  else process.env.UPLOAD_TEMP_DIRECTORY = previousTemporaryDirectory;
});
