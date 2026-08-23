export type RefreshTokenGenerator = {
  generate(): Promise<string>;
};
