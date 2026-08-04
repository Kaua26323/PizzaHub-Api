import { parseEnv } from './env-schema';

export const env = Object.freeze(parseEnv(process.env));
