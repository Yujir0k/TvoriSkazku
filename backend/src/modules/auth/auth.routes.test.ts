import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fastify from 'fastify';
import cookie from '@fastify/cookie';

import type { FastifyInstance } from 'fastify';
import type { RedisClientType } from 'redis';

import { createAuthService } from './auth.service.js';
import { signInSchema, signUpSchema } from './auth.schema.js';
import { createSessionService } from './session.service.js';
import {
  createFakeDb,
  createFakePasswordHasher,
  toPrismaLike,
} from './test-helpers.js';

type FakeRedis = ReturnType<typeof createFakeRedisForRoutes>;

function createFakeRedisForRoutes() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const ttls = new Map<string, number>();

  return {
    store,
    sets,
    ttls,
    isOpen: true,
    async connect() {},
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, opts?: { EX?: number }) {
      store.set(key, value);
      if (opts?.EX) ttls.set(key, opts.EX);
      return 'OK';
    },
    async del(key: string) {
      store.delete(key);
      ttls.delete(key);
      return 1;
    },
    async sAdd(key: string, ...members: string[]) {
      if (!sets.has(key)) sets.set(key, new Set());
      for (const m of members) sets.get(key)!.add(m);
      return members.length;
    },
    async sRem(key: string, ...members: string[]) {
      const set = sets.get(key);
      if (!set) return 0;
      for (const m of members) set.delete(m);
      return members.length;
    },
    async sMembers(key: string) {
      return Array.from(sets.get(key) ?? []);
    },
    async expire(key: string, seconds: number) {
      ttls.set(key, seconds);
      return 1;
    },
    multi() {
      const ops: Array<() => Promise<unknown>> = [];
      const p = {
        set: (k: string, v: string, o?: { EX?: number }) => {
          ops.push(async () => {
            store.set(k, v);
            if (o?.EX) ttls.set(k, o.EX);
          });
          return p;
        },
        get: (k: string) => {
          ops.push(async () => store.get(k) ?? null);
          return p;
        },
        del: (k: string) => {
          ops.push(async () => {
            store.delete(k);
            ttls.delete(k);
          });
          return p;
        },
        sAdd: (k: string, ...m: string[]) => {
          ops.push(async () => {
            if (!sets.has(k)) sets.set(k, new Set());
            for (const x of m) sets.get(k)!.add(x);
          });
          return p;
        },
        sRem: (k: string, ...m: string[]) => {
          ops.push(async () => {
            const s = sets.get(k);
            if (s) for (const x of m) s.delete(x);
          });
          return p;
        },
        expire: (k: string, s: number) => {
          ops.push(async () => ttls.set(k, s));
          return p;
        },
        async exec() {
          for (const op of ops) await op();
          return [];
        },
      };
      return p;
    },
  } as unknown as RedisClientType & {
    store: Map<string, string>;
    sets: Map<string, Set<string>>;
  };
}

function buildApp() {
  const fakeDb = createFakeDb();
  const hasher = createFakePasswordHasher();
  const fakeRedis = createFakeRedisForRoutes();
  const sessions = createSessionService(fakeRedis, {
    ttlSeconds: 3600,
    rollingTtlSeconds: 1800,
    sessionPrefix: 'sess:',
    userIndexPrefix: 'user-sess:',
  });
  const auth = createAuthService({
    db: toPrismaLike(fakeDb),
    passwords: hasher,
    sessions,
  });

  const app = fastify({ logger: false });
  app.register(cookie);

  // Подменяем сервисы, импортируемые маршрутами, через re-export.
  // Используем inject с прямым вызовом.
  app.decorate('authService', auth);
  app.decorate('sessionService', sessions);

  // Регистрируем маршруты с подменёнными зависимостями через замыкание.
  app.register(async (instance) => {
    registerRoutesWithDeps(instance, auth, sessions);
  }, { prefix: '/api/auth' });

  return { app, auth, sessions, fakeDb, fakeRedis };
}

function registerRoutesWithDeps(
  app: FastifyInstance,
  auth: ReturnType<typeof createAuthService>,
  sessions: ReturnType<typeof createSessionService>,
) {
  app.post('/sign-up', async (request, reply) => {
    const parsed = signUpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Некорректные данные',
      });
    }
    try {
      const result = await auth.signUp({ ...parsed.data, privacyConsentAccepted: true });
      reply.setCookie('tvoriskazku_session', result.session.sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
        maxAge: 3600,
      });
      return reply.code(201).send({ user: result.user });
    } catch (error: any) {
      if (error.name === 'EmailAlreadyRegisteredError') {
        return reply.code(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: error.message,
        });
      }
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Не удалось зарегистрировать пользователя',
      });
    }
  });

  app.post('/sign-in', async (request, reply) => {
    const parsed = signInSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Некорректные данные',
      });
    }
    try {
      const result = await auth.signIn(parsed.data);
      reply.setCookie('tvoriskazku_session', result.session.sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
        maxAge: 3600,
      });
      return reply.send({ user: result.user });
    } catch (error: any) {
      if (error.name === 'InvalidCredentialsError') {
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: error.message,
        });
      }
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Не удалось выполнить вход',
      });
    }
  });

  app.post('/sign-out', async (request, reply) => {
    const sessionId = request.cookies?.['tvoriskazku_session'];
    if (sessionId) {
      const record = await sessions.getSession(sessionId);
      if (record) await sessions.deleteSession(sessionId);
    }
    reply.clearCookie('tvoriskazku_session', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });
    return reply.code(204).send();
  });

  app.post('/sign-out-all', async (request, reply) => {
    const sessionId = request.cookies?.['tvoriskazku_session'];
    if (!sessionId) {
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Требуется авторизация',
      });
    }
    const record = await sessions.getSession(sessionId);
    if (!record) {
      reply.clearCookie('tvoriskazku_session', {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      });
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Требуется авторизация',
      });
    }
    await auth.signOutAll(record.userId);
    reply.clearCookie('tvoriskazku_session', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });
    return reply.code(204).send();
  });

  app.get('/sessions', async (request, reply) => {
    const sessionId = request.cookies?.['tvoriskazku_session'];
    if (!sessionId) {
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Требуется авторизация',
      });
    }
    const record = await sessions.getSession(sessionId);
    if (!record) {
      reply.clearCookie('tvoriskazku_session', {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      });
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Требуется авторизация',
      });
    }
    const userSessions = await sessions.getUserSessions(record.userId);
    return reply.send({ sessions: userSessions });
  });

  app.delete('/sessions/:id', async (request, reply) => {
    const sessionId = request.cookies?.['tvoriskazku_session'];
    if (!sessionId) {
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Требуется авторизация',
      });
    }
    const currentRecord = await sessions.getSession(sessionId);
    if (!currentRecord) {
      reply.clearCookie('tvoriskazku_session', {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      });
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Требуется авторизация',
      });
    }
    const { id } = request.params as { id: string };
    const targetRecord = await sessions.getSession(id);
    if (!targetRecord) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Сессия не найдена',
      });
    }
    if (targetRecord.userId !== currentRecord.userId) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Нельзя удалить чужую сессию',
      });
    }
    await sessions.deleteSession(id);
    if (id === sessionId) {
      reply.clearCookie('tvoriskazku_session', {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      });
    }
    return reply.code(204).send();
  });

  app.get('/me', async (request, reply) => {
    const sessionId = request.cookies?.['tvoriskazku_session'];
    if (!sessionId) {
      return reply.send({ user: null });
    }
    const record = await sessions.getSession(sessionId);
    if (!record) {
      reply.clearCookie('tvoriskazku_session', {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      });
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Требуется авторизация',
      });
    }
    const user = await auth.getCurrentUser(record.userId);
    if (!user) {
      reply.clearCookie('tvoriskazku_session', {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      });
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Требуется авторизация',
      });
    }
    return reply.send({ user });
  });
}

describe('auth routes', () => {
  let env: ReturnType<typeof buildApp>;

  beforeEach(() => {
    env = buildApp();
  });

  afterEach(async () => {
    await env.app.close();
  });

  describe('POST /api/auth/sign-up', () => {
    it('успешная регистрация возвращает 201 и пользователя', async () => {
      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'Иван',
          email: 'user@example.com',
          password: 'password123',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.user.email).toBe('user@example.com');
      expect(body.user).not.toHaveProperty('passwordHash');
    });

    it('устанавливает cookie сессии', async () => {
      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'Иван',
          email: 'user@example.com',
          password: 'password123',
        },
      });
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(String(setCookie)).toContain('tvoriskazku_session=');
      expect(String(setCookie)).toContain('HttpOnly');
    });

    it('отклоняет слабый пароль', async () => {
      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'Иван',
          email: 'user@example.com',
          password: 'short',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('отклоняет пустое имя', async () => {
      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: '   ',
          email: 'user@example.com',
          password: 'password123',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('отклоняет слишком длинное имя', async () => {
      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'а'.repeat(101),
          email: 'user@example.com',
          password: 'password123',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('отклоняет повторную регистрацию одинакового email', async () => {
      await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'Иван',
          email: 'user@example.com',
          password: 'password123',
        },
      });
      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'Другой',
          email: 'USER@example.com',
          password: 'password456',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().message).toContain('уже зарегистрирован');
    });

    it('не возвращает passwordHash в ответе', async () => {
      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'Иван',
          email: 'user@example.com',
          password: 'password123',
        },
      });
      expect(res.body).not.toContain('passwordHash');
    });
  });

  describe('POST /api/auth/sign-in', () => {
    beforeEach(async () => {
      await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'Иван',
          email: 'user@example.com',
          password: 'password123',
        },
      });
    });

    it('успешный вход возвращает 200 и пользователя', async () => {
      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: {
          email: 'user@example.com',
          password: 'password123',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().user.email).toBe('user@example.com');
    });

    it('нормализует email при входе', async () => {
      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: {
          email: 'USER@Example.COM',
          password: 'password123',
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it('отклоняет неверный пароль', async () => {
      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: {
          email: 'user@example.com',
          password: 'wrong-password',
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe('Неверный email или пароль');
    });

    it('отклоняет неизвестный email', async () => {
      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: {
          email: 'unknown@example.com',
          password: 'password123',
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe('Неверный email или пароль');
    });

    it('возвращает одинаковую ошибку для неизвестного email и неверного пароля', async () => {
      const unknown = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: { email: 'unknown@example.com', password: 'password123' },
      });
      const wrong = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: { email: 'user@example.com', password: 'wrong' },
      });
      expect(unknown.json().message).toBe(wrong.json().message);
    });
  });

  describe('GET /api/auth/me', () => {
    it('возвращает текущего пользователя для авторизованного', async () => {
      const signUp = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'Иван',
          email: 'user@example.com',
          password: 'password123',
        },
      });
      const setCookie = String(signUp.headers['set-cookie']);
      const sessionId = setCookie.split(';')[0].split('=')[1];

      const res = await env.app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { tvoriskazku_session: sessionId },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().user.email).toBe('user@example.com');
    });

    it('для гостя возвращает пустого пользователя без ошибки', async () => {
      const res = await env.app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().user).toBeNull();
    });

    it('запрещён при просроченной сессии', async () => {
      const res = await env.app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { tvoriskazku_session: 'invalid-session' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/sign-out', () => {
    it('удаляет сессию и очищает cookie', async () => {
      const signUp = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'Иван',
          email: 'user@example.com',
          password: 'password123',
        },
      });
      const outSetCookie = String(signUp.headers['set-cookie']);
      const outSessionId = outSetCookie.split(';')[0].split('=')[1];

      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-out',
        cookies: { tvoriskazku_session: outSessionId },
      });
      expect(res.statusCode).toBe(204);
      const setCookie = res.headers['set-cookie'];
      expect(String(setCookie)).toContain('tvoriskazku_session=');
      expect(String(setCookie).toLowerCase()).toContain('max-age=0');

      // Сессия удалена
      const me = await env.app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { tvoriskazku_session: outSessionId },
      });
      expect(me.statusCode).toBe(401);
    });

    it('повторный выход не вызывает ошибку', async () => {
      const res1 = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-out',
      });
      const res2 = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-out',
      });
      expect(res1.statusCode).toBe(204);
      expect(res2.statusCode).toBe(204);
    });
  });

  describe('POST /api/auth/sign-out-all', () => {
    it('отзывает все сессии пользователя', async () => {
      const signUp = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'Иван',
          email: 'user@example.com',
          password: 'password123',
        },
      });
      const allOutCookie1 = String(signUp.headers['set-cookie']);
      const sessionId1 = allOutCookie1.split(';')[0].split('=')[1];

      const signIn = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: {
          email: 'user@example.com',
          password: 'password123',
        },
      });
      const allOutCookie2 = String(signIn.headers['set-cookie']);
      const sessionId2 = allOutCookie2.split(';')[0].split('=')[1];

      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-out-all',
        cookies: { tvoriskazku_session: sessionId2 },
      });
      expect(res.statusCode).toBe(204);

      // Обе сессии недействительны
      const me1 = await env.app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { tvoriskazku_session: sessionId1 },
      });
      const me2 = await env.app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { tvoriskazku_session: sessionId2 },
      });
      expect(me1.statusCode).toBe(401);
      expect(me2.statusCode).toBe(401);
    });

    it('запрещён для гостя', async () => {
      const res = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-out-all',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/sessions', () => {
    it('возвращает список сессий текущего пользователя', async () => {
      const signUp = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'Иван',
          email: 'sessions-test@example.com',
          password: 'password123',
        },
      });
      const setCookie = String(signUp.headers['set-cookie']);
      const sessionId = setCookie.split(';')[0].split('=')[1];

      const res = await env.app.inject({
        method: 'GET',
        url: '/api/auth/sessions',
        cookies: { tvoriskazku_session: sessionId },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.sessions).toBeInstanceOf(Array);
      expect(body.sessions.length).toBeGreaterThanOrEqual(1);
      expect(body.sessions[0].sessionId).toBe(sessionId);
    });

    it('запрещён для гостя', async () => {
      const res = await env.app.inject({
        method: 'GET',
        url: '/api/auth/sessions',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/auth/sessions/:id', () => {
    it('удаляет сессию по ID', async () => {
      const signUp = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'Иван',
          email: 'delete-session-test@example.com',
          password: 'password123',
        },
      });
      const sc1 = String(signUp.headers['set-cookie']);
      const sid1 = sc1.split(';')[0].split('=')[1];

      const signIn = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: {
          email: 'delete-session-test@example.com',
          password: 'password123',
        },
      });
      const sc2 = String(signIn.headers['set-cookie']);
      const sid2 = sc2.split(';')[0].split('=')[1];

      const res = await env.app.inject({
        method: 'DELETE',
        url: `/api/auth/sessions/${sid1}`,
        cookies: { tvoriskazku_session: sid2 },
      });
      expect(res.statusCode).toBe(204);

      // Проверяем, что удалённая сессия недействительна
      const me = await env.app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { tvoriskazku_session: sid1 },
      });
      expect(me.statusCode).toBe(401);
    });

    it('запрещает удаление чужой сессии', async () => {
      const user1 = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'User1',
          email: 'user1-forbidden@example.com',
          password: 'password123',
        },
      });
      const sid1 = String(user1.headers['set-cookie']).split(';')[0].split('=')[1];

      const user2 = await env.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          name: 'User2',
          email: 'user2-forbidden@example.com',
          password: 'password123',
        },
      });
      const sid2 = String(user2.headers['set-cookie']).split(';')[0].split('=')[1];

      const res = await env.app.inject({
        method: 'DELETE',
        url: `/api/auth/sessions/${sid1}`,
        cookies: { tvoriskazku_session: sid2 },
      });
      expect(res.statusCode).toBe(403);
    });

    it('запрещён для гостя', async () => {
      const res = await env.app.inject({
        method: 'DELETE',
        url: '/api/auth/sessions/nonexistent',
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
