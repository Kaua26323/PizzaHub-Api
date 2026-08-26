export type RefreshTokenHasher = {
  hash(token: string): Promise<string>;
};
