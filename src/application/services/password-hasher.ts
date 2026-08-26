export type PasswordHasher = {
  hash(password: string): Promise<string>;
  compare(hash: string, password: string): Promise<boolean>;
};
