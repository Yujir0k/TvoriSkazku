import argon2 from 'argon2';

export type PasswordHasher = {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
};

export type PasswordHasherOptions = {
  type?: 0 | 1 | 2;
  memoryCost?: number;
  timeCost?: number;
  parallelism?: number;
};

const defaultOptions: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function createPasswordHasher(options: argon2.Options = defaultOptions): PasswordHasher {
  return {
    async hash(password: string): Promise<string> {
      return argon2.hash(password, options);
    },
    async verify(hash: string, password: string): Promise<boolean> {
      try {
        return await argon2.verify(hash, password);
      } catch {
        return false;
      }
    },
  };
}

export const passwordHasher = createPasswordHasher();
