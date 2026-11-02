import type { BusboyMultipartParserOptions } from '@/presentation/http/parsers/busboy-multipart-parse';

export type ProductMultipartOptions = Omit<
  BusboyMultipartParserOptions,
  'request' | 'requireImage' | 'maxFields'
>;
