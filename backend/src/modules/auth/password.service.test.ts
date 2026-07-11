import { describe, it, expect } from 'vitest';

import { createPasswordHasher } from './password.service.js';

describe('password service', () => {
  const hasher = createPasswordHasher();

  it('хеширует пароль через argon2id', async () => {
    const hash = await hasher.hash('super-secret-123');
    expect(hash).not.toBe('super-secret-123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('верифицирует корректный пароль', async () => {
    const hash = await hasher.hash('correct-password');
    const valid = await hasher.verify(hash, 'correct-password');
    expect(valid).toBe(true);
  });

  it('отклоняет неверный пароль', async () => {
    const hash = await hasher.hash('correct-password');
    const valid = await hasher.verify(hash, 'wrong-password');
    expect(valid).toBe(false);
  });

  it('возвращает false при проверке против невалидного хеша', async () => {
    const valid = await hasher.verify('not-a-valid-hash', 'password');
    expect(valid).toBe(false);
  });

  it('создаёт разные хеши для одинаковых паролей (соль)', async () => {
    const hash1 = await hasher.hash('same-password');
    const hash2 = await hasher.hash('same-password');
    expect(hash1).not.toBe(hash2);
  });
});
