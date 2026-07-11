import { describe, it, expect, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

import { createAuthService, EmailAlreadyRegisteredError, InvalidCredentialsError } from './auth.service.js';
import {
  createFakeDb,
  createFakePasswordHasher,
  createFakeSessionService,
  toPrismaLike,
  type FakeUserRecord,
} from './test-helpers.js';

describe('auth service', () => {
  let fakeDb: ReturnType<typeof createFakeDb>;
  let hasher: ReturnType<typeof createFakePasswordHasher>;
  let sessions: ReturnType<typeof createFakeSessionService>;
  let service: ReturnType<typeof createAuthService>;

  beforeEach(() => {
    fakeDb = createFakeDb();
    hasher = createFakePasswordHasher();
    sessions = createFakeSessionService();
    service = createAuthService({
      db: toPrismaLike(fakeDb),
      passwords: hasher,
      sessions,
    });
  });

  describe('signUp', () => {
    it('успешная регистрация создаёт пользователя и сессию', async () => {
      const result = await service.signUp({
        name: 'Иван',
        email: 'USER@Example.COM',
        password: 'password123',
        privacyConsentAccepted: true,
      });

      expect(result.user.email).toBe('USER@Example.COM');
      expect(result.user.name).toBe('Иван');
      expect(result.user.emailVerified).toBeNull();
      expect(result.session.userId).toBe(result.user.id);
      expect(result.session.sessionId).toBeTruthy();
    });

    it('нормализует email при сохранении', async () => {
      await service.signUp({
        name: 'Иван',
        email: '  User@Example.COM  ',
        password: 'password123',
        privacyConsentAccepted: true,
      });

      const stored = Array.from(fakeDb.store.values())[0];
      expect(stored.normalizedEmail).toBe('user@example.com');
      expect(stored.email).toBe('User@Example.COM');
    });

    it('отклоняет повторную регистрацию одинакового email', async () => {
      await service.signUp({
        name: 'Иван',
        email: 'user@example.com',
        password: 'password123',
        privacyConsentAccepted: true,
      });

      await expect(
        service.signUp({
          name: 'Другой',
          email: 'USER@example.com',
          password: 'password456',
          privacyConsentAccepted: true,
        }),
      ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    });

    it('не возвращает passwordHash в публичном пользователе', async () => {
      const result = await service.signUp({
        name: 'Иван',
        email: 'user@example.com',
        password: 'password123',
        privacyConsentAccepted: true,
      });

      expect(result.user).not.toHaveProperty('passwordHash');
      const serialized = JSON.stringify(result.user);
      expect(serialized).not.toContain('passwordHash');
    });
  });

  describe('signIn', () => {
    beforeEach(async () => {
      await service.signUp({
        name: 'Иван',
        email: 'user@example.com',
        password: 'password123',
        privacyConsentAccepted: true,
      });
    });

    it('успешный вход создаёт новую сессию', async () => {
      const result = await service.signIn({
        email: 'USER@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('user@example.com');
      expect(result.session.userId).toBe(result.user.id);
    });

    it('отклоняет неверный пароль', async () => {
      await expect(
        service.signIn({
          email: 'user@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it('отклоняет неизвестный email', async () => {
      await expect(
        service.signIn({
          email: 'unknown@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it('возвращает одинаковую ошибку для неизвестного email и неверного пароля', async () => {
      const unknownError = await service
        .signIn({ email: 'unknown@example.com', password: 'password123' })
        .catch((e) => e);
      const wrongPasswordError = await service
        .signIn({ email: 'user@example.com', password: 'wrong' })
        .catch((e) => e);

      expect(unknownError.message).toBe(wrongPasswordError.message);
    });
  });

  describe('signOut', () => {
    it('удаляет сессию', async () => {
      const { session } = await service.signUp({
        name: 'Иван',
        email: 'user@example.com',
        password: 'password123',
        privacyConsentAccepted: true,
      });

      await service.signOut(session.sessionId);
      expect(sessions.sessions.has(session.sessionId)).toBe(false);
    });

    it('повторный выход не вызывает ошибку', async () => {
      const { session } = await service.signUp({
        name: 'Иван',
        email: 'user@example.com',
        password: 'password123',
        privacyConsentAccepted: true,
      });

      await service.signOut(session.sessionId);
      await expect(service.signOut(session.sessionId)).resolves.toBeUndefined();
    });
  });

  describe('signOutAll', () => {
    it('отзывает все сессии пользователя', async () => {
      const first = await service.signUp({
        name: 'Иван',
        email: 'user@example.com',
        password: 'password123',
        privacyConsentAccepted: true,
      });
      const second = await service.signIn({
        email: 'user@example.com',
        password: 'password123',
      });

      const deleted = await service.signOutAll(first.user.id);
      expect(deleted).toHaveLength(2);
      expect(sessions.sessions.has(first.session.sessionId)).toBe(false);
      expect(sessions.sessions.has(second.session.sessionId)).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('возвращает публичного пользователя', async () => {
      const result = await service.signUp({
        name: 'Иван',
        email: 'user@example.com',
        password: 'password123',
        privacyConsentAccepted: true,
      });
      const user = result.user;

      const current = await service.getCurrentUser(user.id);
      expect(current?.id).toBe(user.id);
      expect(current).not.toHaveProperty('passwordHash');
    });

    it('возвращает null для несуществующего пользователя', async () => {
      const current = await service.getCurrentUser('nonexistent');
      expect(current).toBeNull();
    });
  });
});
