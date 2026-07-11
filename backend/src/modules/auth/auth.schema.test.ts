import { describe, it, expect } from 'vitest';

import { signInSchema, signUpSchema } from './auth.schema.js';

describe('auth schemas', () => {
  describe('signUpSchema', () => {
    it('принимает корректные данные (с согласием)', () => {
      const result = signUpSchema.safeParse({
        name: 'Иван',
        email: 'user@example.com',
        password: 'password123',
        privacyConsentAccepted: true,
      });
      expect(result.success).toBe(true);
    });

    it('принимает данные без явного согласия (опциональное поле)', () => {
      const result = signUpSchema.safeParse({
        name: 'Иван',
        email: 'user@example.com',
        password: 'password123',
      });
      // Поле опциональное — схема пропускает, но сервис проверит и вернёт ошибку
      expect(result.success).toBe(true);
    });

    it('отклоняет пустое имя', () => {
      const result = signUpSchema.safeParse({
        name: '   ',
        email: 'user@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('отклоняет слишком длинное имя', () => {
      const result = signUpSchema.safeParse({
        name: 'а'.repeat(101),
        email: 'user@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('отклоняет пароль короче 8 символов', () => {
      const result = signUpSchema.safeParse({
        name: 'Иван',
        email: 'user@example.com',
        password: 'short',
      });
      expect(result.success).toBe(false);
    });

    it('отклоняет слишком длинный пароль', () => {
      const result = signUpSchema.safeParse({
        name: 'Иван',
        email: 'user@example.com',
        password: 'a'.repeat(257),
      });
      expect(result.success).toBe(false);
    });

    it('отклоняет некорректный email', () => {
      const result = signUpSchema.safeParse({
        name: 'Иван',
        email: 'not-an-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('signInSchema', () => {
    it('принимает корректные данные', () => {
      const result = signInSchema.safeParse({
        email: 'user@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('отклоняет пустой пароль', () => {
      const result = signInSchema.safeParse({
        email: 'user@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
